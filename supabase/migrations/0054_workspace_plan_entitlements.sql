-- Central Free / Trial / VIP entitlements and server-enforced workspace limits.

update public.plans
set features = '{"modules":["dashboard","students","attendance"],"description":"งานพื้นฐานสำหรับเจ้าของห้องเรียน"}'::jsonb,
    limits = '{"active_classrooms":1,"active_students":40,"collaborators":1,"reports_export":0}'::jsonb,
    updated_at = now()
where code = 'FREE_LOGIN';

update public.plans
set features = '{"modules":["all"],"description":"ทดลองฟังก์ชันครบเหมือน VIP ตามวันที่กำหนด"}'::jsonb,
    limits = '{"active_classrooms":10,"active_students":500,"collaborators":10,"reports_export":1}'::jsonb,
    updated_at = now()
where code = 'TRIAL_30';

update public.plans
set features = '{"modules":["all"],"description":"เปิดทุกโมดูลหลักของ ClassCare 360"}'::jsonb,
    limits = '{"active_classrooms":100,"active_students":5000,"collaborators":100,"reports_export":1}'::jsonb,
    updated_at = now()
where code = 'VIP_YEARLY';

update public.module_entitlements me
set is_enabled = false
from public.plans p
where me.plan_id = p.id and p.code in ('FREE_LOGIN', 'TRIAL_30', 'VIP_YEARLY');

insert into public.module_entitlements (plan_id, module_key, is_enabled, limits)
select p.id, m.module_key, true, m.module_limits
from public.plans p
cross join (
  values
    ('dashboard', '{}'::jsonb),
    ('students', '{"active_students":40}'::jsonb),
    ('attendance', '{}'::jsonb),
    ('payment', '{}'::jsonb),
    ('support', '{}'::jsonb)
) as m(module_key, module_limits)
where p.code = 'FREE_LOGIN'
on conflict (plan_id, module_key) do update
set is_enabled = excluded.is_enabled, limits = excluded.limits;

insert into public.module_entitlements (plan_id, module_key, is_enabled, limits)
select p.id, m.module_key, true, '{}'::jsonb
from public.plans p
cross join (
  values ('dashboard'), ('students'), ('attendance'), ('scores'), ('savings'), ('behavior'),
    ('student_care'), ('home_visits'), ('reports'), ('import_export'), ('notifications'),
    ('parent_portal'), ('student_portal'), ('google_drive_cold_storage'), ('teacher_backup'),
    ('classroom_randomizer'), ('payment'), ('support')
) as m(module_key)
where p.code in ('TRIAL_30', 'VIP_YEARLY')
on conflict (plan_id, module_key) do update
set is_enabled = excluded.is_enabled, limits = excluded.limits;

create or replace function public.workspace_effective_plan_code(target_workspace_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.code
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id and p.is_active = true
      where s.workspace_id = target_workspace_id
        and s.status in ('trial', 'active')
        and (s.starts_at is null or s.starts_at <= now())
        and (s.ends_at is null or s.ends_at > now())
      order by case when p.code = 'VIP_YEARLY' then 0 else 1 end, s.created_at desc
      limit 1
    ),
    'FREE_LOGIN'
  );
$$;

create or replace function public.workspace_plan_limit(
  target_workspace_id uuid,
  target_limit_key text,
  fallback_limit integer default 0
)
returns integer
language sql stable security definer
set search_path = public
as $$
  select coalesce((p.limits ->> target_limit_key)::integer, fallback_limit)
  from public.plans p
  where p.code = public.workspace_effective_plan_code(target_workspace_id)
    and p.is_active = true
  limit 1;
$$;

create or replace function public.can_use_module(
  target_workspace_id uuid,
  target_module_key text
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_superadmin() or (
    public.is_workspace_member(target_workspace_id)
    and exists (
      select 1
      from public.plans p
      join public.module_entitlements me on me.plan_id = p.id
      where p.code = public.workspace_effective_plan_code(target_workspace_id)
        and p.is_active = true
        and me.module_key = target_module_key
        and me.is_enabled = true
    )
  );
$$;

create or replace function public.has_workspace_capability(
  target_workspace_id uuid,
  capability_key text
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
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
        when 'student_care.write' then public.can_use_module(target_workspace_id, 'student_care')
        when 'home_visits.write' then public.can_use_module(target_workspace_id, 'home_visits')
        when 'automation.manage' then public.can_use_module(target_workspace_id, 'student_care')
        when 'communications.prepare' then public.can_use_module(target_workspace_id, 'notifications')
        when 'communications.approve' then public.can_use_module(target_workspace_id, 'notifications')
        when 'data.bulk' then public.can_use_module(target_workspace_id, 'import_export')
        when 'reports.export' then public.can_use_module(target_workspace_id, 'reports')
          and public.workspace_plan_limit(target_workspace_id, 'reports_export', 0) > 0
        else true
      end
  );
$$;

create or replace function public.enforce_workspace_plan_resource_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  resource_limit integer;
  current_count integer;
begin
  if tg_table_name = 'classrooms' and new.status = 'active' then
    resource_limit := public.workspace_plan_limit(new.workspace_id, 'active_classrooms', 1);
    select count(*) into current_count from public.classrooms c
    where c.workspace_id = new.workspace_id and c.status = 'active' and c.id <> new.id;
    if current_count >= resource_limit then raise exception 'workspace_classroom_limit_reached'; end if;
  elsif tg_table_name = 'students' and new.status = 'active' then
    resource_limit := public.workspace_plan_limit(new.workspace_id, 'active_students', 40);
    select count(*) into current_count from public.students s
    where s.workspace_id = new.workspace_id and s.status = 'active' and s.id <> new.id;
    if current_count >= resource_limit then raise exception 'workspace_student_limit_reached'; end if;
  elsif tg_table_name = 'workspace_memberships' and new.status = 'active' and new.role <> 'teacher_owner' then
    resource_limit := public.workspace_plan_limit(new.workspace_id, 'collaborators', 1);
    select count(*) into current_count from public.workspace_memberships wm
    where wm.workspace_id = new.workspace_id and wm.status = 'active'
      and wm.role <> 'teacher_owner' and wm.profile_id <> new.profile_id;
    if current_count >= resource_limit then raise exception 'workspace_collaborator_limit_reached'; end if;
  elsif tg_table_name = 'workspace_teacher_invitations' and new.status = 'invited' then
    resource_limit := public.workspace_plan_limit(new.workspace_id, 'collaborators', 1);
    select
      (select count(*) from public.workspace_memberships wm
       where wm.workspace_id = new.workspace_id and wm.status = 'active' and wm.role <> 'teacher_owner')
      +
      (select count(*) from public.workspace_teacher_invitations i
       where i.workspace_id = new.workspace_id and i.status = 'invited' and i.id <> new.id)
    into current_count;
    if current_count >= resource_limit then raise exception 'workspace_collaborator_limit_reached'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists classrooms_enforce_plan_limit on public.classrooms;
create trigger classrooms_enforce_plan_limit before insert or update on public.classrooms
for each row execute function public.enforce_workspace_plan_resource_limit();
drop trigger if exists students_enforce_plan_limit on public.students;
create trigger students_enforce_plan_limit before insert or update on public.students
for each row execute function public.enforce_workspace_plan_resource_limit();
drop trigger if exists workspace_memberships_enforce_plan_limit on public.workspace_memberships;
create trigger workspace_memberships_enforce_plan_limit before insert or update on public.workspace_memberships
for each row execute function public.enforce_workspace_plan_resource_limit();
drop trigger if exists workspace_teacher_invitations_enforce_plan_limit on public.workspace_teacher_invitations;
create trigger workspace_teacher_invitations_enforce_plan_limit before insert or update on public.workspace_teacher_invitations
for each row execute function public.enforce_workspace_plan_resource_limit();

drop policy if exists "classrooms_insert_owner_or_superadmin" on public.classrooms;
create policy "classrooms_insert_owner_with_plan_limit"
on public.classrooms for insert to authenticated
with check (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']))
  and public.can_use_module(workspace_id, 'students')
);

drop policy if exists "students_insert_scoped_teacher_or_superadmin" on public.students;
create policy "students_insert_scoped_teacher_with_plan"
on public.students for insert to authenticated
with check (
  public.can_use_module(workspace_id, 'students')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or (classroom_id is not null and public.can_access_classroom(workspace_id, classroom_id))
  )
);

-- Premium raw data stays unavailable through direct API calls on Free.
drop policy if exists "score_assessments_select_scoped_teachers" on public.score_assessments;
create policy "score_assessments_select_entitled_teachers"
on public.score_assessments for select to authenticated
using (
  public.can_use_module(workspace_id, 'scores')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_classroom(workspace_id, classroom_id)
);

drop policy if exists "score_entries_select_scoped_teachers" on public.score_entries;
create policy "score_entries_select_entitled_teachers"
on public.score_entries for select to authenticated
using (
  public.can_use_module(workspace_id, 'scores')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_score_assessment(workspace_id, assessment_id)
);

drop policy if exists "savings_accounts_select_scoped_teachers" on public.savings_accounts;
create policy "savings_accounts_select_entitled_teachers" on public.savings_accounts for select to authenticated
using (
  public.can_use_module(workspace_id, 'savings')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);
drop policy if exists "savings_transactions_select_scoped_teachers" on public.savings_transactions;
create policy "savings_transactions_select_entitled_teachers" on public.savings_transactions for select to authenticated
using (
  public.can_use_module(workspace_id, 'savings')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);
drop policy if exists "behavior_records_select_scoped_teachers" on public.behavior_records;
create policy "behavior_records_select_entitled_teachers" on public.behavior_records for select to authenticated
using (
  public.can_use_module(workspace_id, 'behavior')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);
drop policy if exists "student_care_cases_select_scoped_teachers" on public.student_care_cases;
create policy "student_care_cases_select_entitled_teachers" on public.student_care_cases for select to authenticated
using (
  public.can_use_module(workspace_id, 'student_care')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);
drop policy if exists "student_home_visits_select_scoped_teachers" on public.student_home_visits;
create policy "student_home_visits_select_entitled_teachers" on public.student_home_visits for select to authenticated
using (
  public.can_use_module(workspace_id, 'home_visits')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);

revoke all on function public.workspace_effective_plan_code(uuid) from public;
revoke all on function public.workspace_plan_limit(uuid, text, integer) from public;
revoke all on function public.enforce_workspace_plan_resource_limit() from public;
grant execute on function public.workspace_effective_plan_code(uuid) to authenticated;
grant execute on function public.workspace_plan_limit(uuid, text, integer) to authenticated;

notify pgrst, 'reload schema';
