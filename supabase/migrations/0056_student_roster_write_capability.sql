-- Separate roster write permission from classroom visibility.
-- A viewer may read assigned classrooms but must not mutate student records.

create or replace function public.workspace_capability_defaults(member_role text)
returns jsonb
language sql immutable
set search_path = public
as $$
  select case member_role
    when 'teacher_owner' then jsonb_build_object(
      'students.write', true,
      'attendance.write', true, 'scores.write', true, 'behavior.write', true,
      'student_care.write', true, 'home_visits.write', true, 'savings.write', true,
      'reports.export', true, 'communications.prepare', true, 'communications.approve', true,
      'automation.manage', true, 'members.manage', true, 'workspace.manage', true,
      'recovery.restore', true, 'data.bulk', true
    )
    when 'teacher_member' then jsonb_build_object(
      'students.write', true,
      'attendance.write', true, 'scores.write', true, 'behavior.write', true,
      'student_care.write', true, 'home_visits.write', true, 'savings.write', false,
      'reports.export', true, 'communications.prepare', true, 'communications.approve', false,
      'automation.manage', false, 'members.manage', false, 'workspace.manage', false,
      'recovery.restore', false, 'data.bulk', true
    )
    when 'viewer' then jsonb_build_object(
      'students.write', false,
      'attendance.write', false, 'scores.write', false, 'behavior.write', false,
      'student_care.write', false, 'home_visits.write', false, 'savings.write', false,
      'reports.export', true, 'communications.prepare', false, 'communications.approve', false,
      'automation.manage', false, 'members.manage', false, 'workspace.manage', false,
      'recovery.restore', false, 'data.bulk', false
    )
    else '{}'::jsonb
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
    'students.write','attendance.write','scores.write','behavior.write','student_care.write',
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

drop policy if exists "students_insert_scoped_teacher_with_plan" on public.students;
drop policy if exists "students_insert_scoped_teacher_or_superadmin" on public.students;
create policy "students_insert_scoped_writer_with_plan"
on public.students for insert to authenticated
with check (
  public.can_use_module(workspace_id, 'students')
  and public.has_workspace_capability(workspace_id, 'students.write')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or (classroom_id is not null and public.can_access_classroom(workspace_id, classroom_id))
  )
);

drop policy if exists "students_update_scoped_teacher_or_superadmin" on public.students;
drop policy if exists "students_update_teacher_or_superadmin" on public.students;
create policy "students_update_scoped_writer"
on public.students for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'students.write')
  and public.can_access_student(workspace_id, id)
)
with check (
  public.can_use_module(workspace_id, 'students')
  and public.has_workspace_capability(workspace_id, 'students.write')
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner'])
    or (classroom_id is not null and public.can_access_classroom(workspace_id, classroom_id))
  )
);

revoke all on function public.workspace_capability_defaults(text) from public;
revoke all on function public.set_workspace_member_access(uuid, uuid, jsonb, uuid[]) from public;
grant execute on function public.workspace_capability_defaults(text) to authenticated;
grant execute on function public.set_workspace_member_access(uuid, uuid, jsonb, uuid[]) to authenticated;

notify pgrst, 'reload schema';
