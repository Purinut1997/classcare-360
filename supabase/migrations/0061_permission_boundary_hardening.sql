-- Harden workspace permissions for duty rosters, automation, daily briefs and public RPC access.

revoke create on schema public from public, anon, authenticated;

create or replace function public.workspace_capability_defaults(member_role text)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select case member_role
    when 'teacher_owner' then jsonb_build_object(
      'students.write', true,
      'attendance.write', true, 'scores.write', true, 'behavior.write', true,
      'student_care.write', true, 'home_visits.write', true, 'savings.write', true,
      'duty.manage', true, 'daily_brief.write', true,
      'reports.export', true, 'communications.prepare', true, 'communications.approve', true,
      'automation.manage', true, 'members.manage', true, 'workspace.manage', true,
      'recovery.restore', true, 'data.bulk', true
    )
    when 'teacher_member' then jsonb_build_object(
      'students.write', true,
      'attendance.write', true, 'scores.write', true, 'behavior.write', true,
      'student_care.write', true, 'home_visits.write', true, 'savings.write', false,
      'duty.manage', true, 'daily_brief.write', true,
      'reports.export', true, 'communications.prepare', true, 'communications.approve', false,
      'automation.manage', false, 'members.manage', false, 'workspace.manage', false,
      'recovery.restore', false, 'data.bulk', true
    )
    when 'viewer' then jsonb_build_object(
      'students.write', false,
      'attendance.write', false, 'scores.write', false, 'behavior.write', false,
      'student_care.write', false, 'home_visits.write', false, 'savings.write', false,
      'duty.manage', false, 'daily_brief.write', false,
      'reports.export', true, 'communications.prepare', false, 'communications.approve', false,
      'automation.manage', false, 'members.manage', false, 'workspace.manage', false,
      'recovery.restore', false, 'data.bulk', false
    )
    else '{}'::jsonb
  end;
$$;

create or replace function public.has_workspace_capability(
  target_workspace_id uuid,
  capability_key text
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = (select auth.uid())
      and wm.status = 'active'
      and coalesce(
        (wm.permissions ->> capability_key)::boolean,
        (public.workspace_capability_defaults(wm.role) ->> capability_key)::boolean,
        false
      )
      and case capability_key
        when 'attendance.write' then public.can_use_module(target_workspace_id, 'attendance')
        when 'scores.write' then public.can_use_module(target_workspace_id, 'scores')
        when 'savings.write' then public.can_use_module(target_workspace_id, 'savings')
        when 'behavior.write' then public.can_use_module(target_workspace_id, 'behavior')
        when 'duty.manage' then public.can_use_module(target_workspace_id, 'behavior')
        when 'student_care.write' then public.can_use_module(target_workspace_id, 'student_care')
        when 'home_visits.write' then public.can_use_module(target_workspace_id, 'home_visits')
        when 'automation.manage' then public.can_use_module(target_workspace_id, 'student_care')
        when 'communications.prepare' then public.can_use_module(target_workspace_id, 'notifications')
        when 'communications.approve' then public.can_use_module(target_workspace_id, 'notifications')
        when 'daily_brief.write' then public.can_use_module(target_workspace_id, 'reports')
        when 'data.bulk' then public.can_use_module(target_workspace_id, 'import_export')
        when 'reports.export' then public.can_use_module(target_workspace_id, 'reports')
          and public.workspace_plan_limit(target_workspace_id, 'reports_export', 0) > 0
        else true
      end
  );
$$;

create or replace function public.can_access_workspace_scope(
  target_workspace_id uuid,
  target_classroom_id uuid
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
    or (
      target_classroom_id is not null
      and public.can_access_classroom(target_workspace_id, target_classroom_id)
    )
    or (
      target_classroom_id is null
      and exists (
        select 1
        from public.workspace_memberships wm
        where wm.workspace_id = target_workspace_id
          and wm.profile_id = (select auth.uid())
          and wm.status = 'active'
          and wm.role in ('teacher_member', 'viewer')
          and coalesce((wm.permissions ->> 'scope.all_classrooms')::boolean, false)
      )
    );
$$;

create or replace function public.can_access_duty_assignment(
  target_workspace_id uuid,
  target_duty_week_id uuid
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.duty_weeks dw
    where dw.id = target_duty_week_id
      and dw.workspace_id = target_workspace_id
      and public.can_access_workspace_scope(dw.workspace_id, dw.classroom_id)
  );
$$;

create or replace function public.can_access_daily_brief(
  target_workspace_id uuid,
  target_brief_id uuid,
  require_write boolean default false
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_school_briefs b
    where b.id = target_brief_id
      and b.workspace_id = target_workspace_id
      and public.can_use_module(b.workspace_id, 'reports')
      and public.can_access_workspace_scope(b.workspace_id, b.classroom_id)
      and (not require_write or public.has_workspace_capability(b.workspace_id, 'daily_brief.write'))
  );
$$;

create or replace function public.can_access_daily_brief_log(
  target_workspace_id uuid,
  target_log_id uuid,
  require_write boolean default false
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_brief_logs l
    where l.id = target_log_id
      and l.workspace_id = target_workspace_id
      and public.can_use_module(l.workspace_id, 'reports')
      and public.can_access_workspace_scope(l.workspace_id, l.classroom_id)
      and (not require_write or public.has_workspace_capability(l.workspace_id, 'daily_brief.write'))
  );
$$;

create or replace function public.validate_workspace_member_classroom_scope()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = new.workspace_id and wm.profile_id = new.profile_id
  ) then
    raise exception 'workspace_member_classroom_membership_mismatch';
  end if;

  if not exists (
    select 1 from public.classrooms c
    where c.id = new.classroom_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'workspace_member_classroom_scope_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists workspace_member_classrooms_validate_scope on public.workspace_member_classrooms;
create trigger workspace_member_classrooms_validate_scope
before insert or update on public.workspace_member_classrooms
for each row execute function public.validate_workspace_member_classroom_scope();

create or replace function public.set_workspace_member_access(
  target_workspace_id uuid,
  target_profile_id uuid,
  capability_overrides jsonb,
  assigned_classroom_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  target_role text;
  allowed_keys constant text[] := array[
    'students.write','attendance.write','scores.write','behavior.write','student_care.write',
    'home_visits.write','savings.write','duty.manage','daily_brief.write','reports.export',
    'communications.prepare','communications.approve','automation.manage','members.manage',
    'workspace.manage','recovery.restore','data.bulk','scope.all_classrooms'
  ];
  invalid_key text;
begin
  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'not_allowed';
  end if;

  select wm.role into target_role
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id and wm.profile_id = target_profile_id;

  if target_role is null then raise exception 'membership_not_found'; end if;
  if target_role = 'teacher_owner' and not public.is_superadmin() then
    raise exception 'owner_permissions_are_protected';
  end if;

  select key into invalid_key
  from jsonb_object_keys(coalesce(capability_overrides, '{}'::jsonb)) key
  where key <> all(allowed_keys)
  limit 1;
  if invalid_key is not null then raise exception 'invalid_capability:%', invalid_key; end if;
  if exists (
    select 1 from jsonb_each(coalesce(capability_overrides, '{}'::jsonb)) item
    where jsonb_typeof(item.value) <> 'boolean'
  ) then raise exception 'capability_values_must_be_boolean'; end if;

  if exists (
    select 1 from unnest(coalesce(assigned_classroom_ids, '{}'::uuid[])) classroom_id
    left join public.classrooms c on c.id = classroom_id and c.workspace_id = target_workspace_id
    where c.id is null
  ) then raise exception 'classroom_outside_workspace'; end if;

  update public.workspace_memberships
  set permissions = coalesce(capability_overrides, '{}'::jsonb), updated_at = now()
  where workspace_id = target_workspace_id and profile_id = target_profile_id;

  delete from public.workspace_member_classrooms
  where workspace_id = target_workspace_id and profile_id = target_profile_id;

  insert into public.workspace_member_classrooms
    (workspace_id, profile_id, classroom_id, created_by)
  select target_workspace_id, target_profile_id, classroom_id, (select auth.uid())
  from unnest(coalesce(assigned_classroom_ids, '{}'::uuid[])) classroom_id;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, metadata, risk_level
  ) values (
    target_workspace_id, (select auth.uid()), 'workspace_memberships', target_profile_id,
    'workspace_member.access_updated',
    jsonb_build_object('permissions', capability_overrides, 'classroom_ids', assigned_classroom_ids),
    'high'
  );

  return jsonb_build_object('updated', true, 'profile_id', target_profile_id);
end;
$$;

-- Duty rosters: classroom scope plus plan/capability enforcement.
drop policy if exists duty_tasks_workspace_select on public.duty_tasks;
drop policy if exists duty_tasks_workspace_manage on public.duty_tasks;
create policy duty_tasks_scoped_select on public.duty_tasks for select to authenticated
using (
  public.can_use_module(workspace_id, 'behavior')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);
create policy duty_tasks_scoped_manage on public.duty_tasks for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);

drop policy if exists duty_weeks_workspace_select on public.duty_weeks;
drop policy if exists duty_weeks_workspace_manage on public.duty_weeks;
create policy duty_weeks_scoped_select on public.duty_weeks for select to authenticated
using (
  public.can_use_module(workspace_id, 'behavior')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);
create policy duty_weeks_scoped_manage on public.duty_weeks for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);

drop policy if exists duty_assignments_workspace_select on public.duty_assignments;
drop policy if exists duty_assignments_workspace_manage on public.duty_assignments;
create policy duty_assignments_scoped_select on public.duty_assignments for select to authenticated
using (
  public.can_use_module(workspace_id, 'behavior')
  and public.can_access_duty_assignment(workspace_id, duty_week_id)
);
create policy duty_assignments_scoped_manage on public.duty_assignments for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_duty_assignment(workspace_id, duty_week_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_duty_assignment(workspace_id, duty_week_id)
);

-- Automation: separate read, preparation and approval paths.
drop policy if exists automation_rules_teacher_access on public.automation_rules;
create policy automation_rules_entitled_read on public.automation_rules for select to authenticated
using (
  public.can_use_module(workspace_id, 'student_care')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or public.has_workspace_capability(workspace_id, 'automation.manage')
  )
);
create policy automation_rules_capability_manage on public.automation_rules for all to authenticated
using (public.has_workspace_capability(workspace_id, 'automation.manage'))
with check (public.has_workspace_capability(workspace_id, 'automation.manage'));

drop policy if exists early_warning_signals_teacher_access on public.early_warning_signals;
create policy early_warning_signals_scoped_read on public.early_warning_signals for select to authenticated
using (
  public.can_use_module(workspace_id, 'student_care')
  and public.can_access_student(workspace_id, student_id)
);
create policy early_warning_signals_capability_manage on public.early_warning_signals for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'automation.manage')
  and public.can_access_student(workspace_id, student_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'automation.manage')
  and public.can_access_student(workspace_id, student_id)
);

drop policy if exists communication_approval_queue_teacher_access on public.communication_approval_queue;
create policy communication_queue_scoped_read on public.communication_approval_queue for select to authenticated
using (
  public.can_use_module(workspace_id, 'notifications')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or (student_id is not null and public.can_access_student(workspace_id, student_id))
  )
);
create policy communication_queue_prepare on public.communication_approval_queue for insert to authenticated
with check (
  public.has_workspace_capability(workspace_id, 'communications.prepare')
  and student_id is not null
  and public.can_access_student(workspace_id, student_id)
  and created_by = (select auth.uid())
);
create policy communication_queue_approve on public.communication_approval_queue for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'communications.approve')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or (student_id is not null and public.can_access_student(workspace_id, student_id))
  )
)
with check (
  public.has_workspace_capability(workspace_id, 'communications.approve')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or (student_id is not null and public.can_access_student(workspace_id, student_id))
  )
);

drop policy if exists automation_runs_teacher_access on public.automation_runs;
create policy automation_runs_capability_access on public.automation_runs for all to authenticated
using (public.has_workspace_capability(workspace_id, 'automation.manage'))
with check (public.has_workspace_capability(workspace_id, 'automation.manage'));

-- Daily briefs: reports entitlement, classroom scope and explicit write capability.
drop policy if exists daily_briefs_workspace_read on public.daily_school_briefs;
drop policy if exists daily_briefs_teacher_manage on public.daily_school_briefs;
create policy daily_briefs_entitled_scoped_read on public.daily_school_briefs for select to authenticated
using (
  public.can_use_module(workspace_id, 'reports')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);
create policy daily_briefs_capability_manage on public.daily_school_briefs for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'daily_brief.write')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'daily_brief.write')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);

drop policy if exists daily_logs_workspace_read on public.daily_brief_logs;
drop policy if exists daily_logs_teacher_manage on public.daily_brief_logs;
create policy daily_logs_entitled_scoped_read on public.daily_brief_logs for select to authenticated
using (
  public.can_use_module(workspace_id, 'reports')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);
create policy daily_logs_capability_manage on public.daily_brief_logs for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'daily_brief.write')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'daily_brief.write')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);

drop policy if exists daily_revisions_workspace_read on public.daily_brief_revisions;
drop policy if exists daily_revisions_teacher_create on public.daily_brief_revisions;
create policy daily_revisions_entitled_scoped_read on public.daily_brief_revisions for select to authenticated
using (public.can_access_daily_brief(workspace_id, brief_id, false));
create policy daily_revisions_capability_create on public.daily_brief_revisions for insert to authenticated
with check (
  actor_profile_id = (select auth.uid())
  and public.can_access_daily_brief(workspace_id, brief_id, true)
);

drop policy if exists daily_attachments_workspace_read on public.daily_brief_attachments;
drop policy if exists daily_attachments_teacher_manage on public.daily_brief_attachments;
create policy daily_attachments_entitled_scoped_read on public.daily_brief_attachments for select to authenticated
using (
  (brief_id is not null and public.can_access_daily_brief(workspace_id, brief_id, false))
  or (log_id is not null and public.can_access_daily_brief_log(workspace_id, log_id, false))
);
create policy daily_attachments_capability_manage on public.daily_brief_attachments for all to authenticated
using (
  (brief_id is not null and public.can_access_daily_brief(workspace_id, brief_id, true))
  or (log_id is not null and public.can_access_daily_brief_log(workspace_id, log_id, true))
)
with check (
  uploaded_by = (select auth.uid())
  and (
    (brief_id is not null and public.can_access_daily_brief(workspace_id, brief_id, true))
    or (log_id is not null and public.can_access_daily_brief_log(workspace_id, log_id, true))
  )
);

drop policy if exists daily_brief_files_read on storage.objects;
create policy daily_brief_files_read on storage.objects for select to authenticated using (
  bucket_id = 'daily-briefs'
  and exists (
    select 1 from public.daily_brief_attachments a
    where a.storage_path = name
      and (
        (a.brief_id is not null and public.can_access_daily_brief(a.workspace_id, a.brief_id, false))
        or (a.log_id is not null and public.can_access_daily_brief_log(a.workspace_id, a.log_id, false))
      )
  )
);

drop policy if exists daily_brief_files_insert on storage.objects;
create policy daily_brief_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'daily-briefs'
  and public.has_workspace_capability(((storage.foldername(name))[1])::uuid, 'daily_brief.write')
  and public.can_access_daily_brief(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    true
  )
);

drop policy if exists daily_brief_files_delete on storage.objects;
create policy daily_brief_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'daily-briefs'
  and exists (
    select 1 from public.daily_brief_attachments a
    where a.storage_path = name
      and (
        (a.brief_id is not null and public.can_access_daily_brief(a.workspace_id, a.brief_id, true))
        or (a.log_id is not null and public.can_access_daily_brief_log(a.workspace_id, a.log_id, true))
      )
  )
);

-- Remove PostgreSQL's default PUBLIC function execution and re-open only intentional anonymous APIs.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.normalize_thai_citizen_id(text) to anon, authenticated;
grant execute on function public.get_public_report_schools() to anon, authenticated;
grant execute on function public.lookup_public_student_report(uuid, text, date) to anon, authenticated;
grant execute on function public.create_public_support_ticket(text, text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.get_public_support_ticket(text, text) to anon, authenticated;
grant execute on function public.reply_public_support_ticket(text, text, text) to anon, authenticated;

revoke all on function public.workspace_capability_defaults(text) from public;
revoke all on function public.has_workspace_capability(uuid, text) from public;
revoke all on function public.can_access_workspace_scope(uuid, uuid) from public;
revoke all on function public.can_access_duty_assignment(uuid, uuid) from public;
revoke all on function public.can_access_daily_brief(uuid, uuid, boolean) from public;
revoke all on function public.can_access_daily_brief_log(uuid, uuid, boolean) from public;
revoke all on function public.set_workspace_member_access(uuid, uuid, jsonb, uuid[]) from public;

grant execute on function public.workspace_capability_defaults(text) to authenticated;
grant execute on function public.has_workspace_capability(uuid, text) to authenticated;
grant execute on function public.can_access_workspace_scope(uuid, uuid) to authenticated;
grant execute on function public.can_access_duty_assignment(uuid, uuid) to authenticated;
grant execute on function public.can_access_daily_brief(uuid, uuid, boolean) to authenticated;
grant execute on function public.can_access_daily_brief_log(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_workspace_member_access(uuid, uuid, jsonb, uuid[]) to authenticated;

notify pgrst, 'reload schema';
