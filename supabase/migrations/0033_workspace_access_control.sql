-- ClassCare 360 - scoped role/capability control for teachers and workspace owners.

create table if not exists public.workspace_member_classrooms (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  assignment_role text not null default 'subject_teacher'
    check (assignment_role in ('homeroom_teacher', 'subject_teacher', 'student_care', 'data_officer')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, profile_id, classroom_id)
);

create index if not exists workspace_member_classrooms_profile_idx
  on public.workspace_member_classrooms (profile_id, workspace_id);
create index if not exists workspace_member_classrooms_classroom_idx
  on public.workspace_member_classrooms (classroom_id, workspace_id);

alter table public.workspace_member_classrooms enable row level security;

drop policy if exists "workspace_member_classrooms_read" on public.workspace_member_classrooms;
create policy "workspace_member_classrooms_read"
on public.workspace_member_classrooms for select to authenticated
using (
  public.is_superadmin()
  or profile_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

drop policy if exists "workspace_member_classrooms_manage" on public.workspace_member_classrooms;
create policy "workspace_member_classrooms_manage"
on public.workspace_member_classrooms for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create or replace function public.workspace_capability_defaults(member_role text)
returns jsonb
language sql immutable
set search_path = public
as $$
  select case member_role
    when 'teacher_owner' then jsonb_build_object(
      'attendance.write', true, 'scores.write', true, 'behavior.write', true,
      'student_care.write', true, 'home_visits.write', true, 'savings.write', true,
      'reports.export', true, 'communications.prepare', true, 'communications.approve', true,
      'automation.manage', true, 'members.manage', true, 'workspace.manage', true,
      'recovery.restore', true, 'data.bulk', true
    )
    when 'teacher_member' then jsonb_build_object(
      'attendance.write', true, 'scores.write', true, 'behavior.write', true,
      'student_care.write', true, 'home_visits.write', true, 'savings.write', false,
      'reports.export', true, 'communications.prepare', true, 'communications.approve', false,
      'automation.manage', false, 'members.manage', false, 'workspace.manage', false,
      'recovery.restore', false, 'data.bulk', true
    )
    when 'viewer' then jsonb_build_object(
      'attendance.write', false, 'scores.write', false, 'behavior.write', false,
      'student_care.write', false, 'home_visits.write', false, 'savings.write', false,
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
  );
$$;

create or replace function public.can_access_classroom(
  target_workspace_id uuid,
  target_classroom_id uuid
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
    or exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = target_workspace_id
        and wm.profile_id = auth.uid()
        and wm.status = 'active'
        and wm.role in ('teacher_member', 'viewer')
        and (
          coalesce((wm.permissions ->> 'scope.all_classrooms')::boolean, false)
          or exists (
            select 1 from public.workspace_member_classrooms wmc
            where wmc.workspace_id = target_workspace_id
              and wmc.profile_id = auth.uid()
              and wmc.classroom_id = target_classroom_id
          )
        )
    );
$$;

create or replace function public.get_workspace_member_access(target_workspace_id uuid)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  permissions jsonb,
  classroom_ids uuid[]
)
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'not_allowed';
  end if;

  return query
  select wm.profile_id, p.email, coalesce(p.display_name, p.email), wm.role, wm.status,
    public.workspace_capability_defaults(wm.role) || coalesce(wm.permissions, '{}'::jsonb),
    coalesce(array_agg(wmc.classroom_id) filter (where wmc.classroom_id is not null), '{}'::uuid[])
  from public.workspace_memberships wm
  join public.profiles p on p.id = wm.profile_id
  left join public.workspace_member_classrooms wmc
    on wmc.workspace_id = wm.workspace_id and wmc.profile_id = wm.profile_id
  where wm.workspace_id = target_workspace_id
  group by wm.profile_id, p.email, p.display_name, wm.role, wm.status, wm.permissions
  order by case wm.role when 'teacher_owner' then 1 when 'teacher_member' then 2 when 'viewer' then 3 else 9 end,
    p.display_name nulls last;
end;
$$;

create or replace function public.set_workspace_member_access(
  target_workspace_id uuid,
  target_profile_id uuid,
  capability_overrides jsonb,
  assigned_classroom_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  target_role text;
  allowed_keys constant text[] := array[
    'attendance.write','scores.write','behavior.write','student_care.write',
    'home_visits.write','savings.write','reports.export','communications.prepare',
    'communications.approve','automation.manage','members.manage','workspace.manage',
    'recovery.restore','data.bulk','scope.all_classrooms'
  ];
  invalid_key text;
begin
  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'not_allowed';
  end if;

  select role into target_role
  from public.workspace_memberships
  where workspace_id = target_workspace_id and profile_id = target_profile_id;

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
    select 1
    from jsonb_each(coalesce(capability_overrides, '{}'::jsonb)) item
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
  select target_workspace_id, target_profile_id, classroom_id, auth.uid()
  from unnest(coalesce(assigned_classroom_ids, '{}'::uuid[])) classroom_id;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, metadata, risk_level
  ) values (
    target_workspace_id, auth.uid(), 'workspace_memberships', target_profile_id,
    'workspace_member.access_updated',
    jsonb_build_object('permissions', capability_overrides, 'classroom_ids', assigned_classroom_ids),
    'high'
  );

  return jsonb_build_object('updated', true, 'profile_id', target_profile_id);
end;
$$;

revoke all on function public.workspace_capability_defaults(text) from public;
revoke all on function public.has_workspace_capability(uuid, text) from public;
revoke all on function public.can_access_classroom(uuid, uuid) from public;
revoke all on function public.get_workspace_member_access(uuid) from public;
revoke all on function public.set_workspace_member_access(uuid, uuid, jsonb, uuid[]) from public;
grant execute on function public.workspace_capability_defaults(text) to authenticated;
grant execute on function public.has_workspace_capability(uuid, text) to authenticated;
grant execute on function public.can_access_classroom(uuid, uuid) to authenticated;
grant execute on function public.get_workspace_member_access(uuid) to authenticated;
grant execute on function public.set_workspace_member_access(uuid, uuid, jsonb, uuid[]) to authenticated;

notify pgrst, 'reload schema';
