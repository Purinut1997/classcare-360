-- Safer destructive actions for owner/superadmin flows.
-- These RPCs keep permission checks in the database and return explicit results
-- so the frontend can tell whether a row was actually deleted.

create or replace function public.delete_classroom_safely(target_classroom_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_name text;
  detached_students integer := 0;
  deleted_rows integer := 0;
begin
  select c.workspace_id, c.name
    into target_workspace_id, target_name
  from public.classrooms c
  where c.id = target_classroom_id;

  if target_workspace_id is null then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'classroom_id', target_classroom_id
    );
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not allowed to delete classroom'
      using errcode = '42501';
  end if;

  update public.students
  set classroom_id = null
  where classroom_id = target_classroom_id;
  get diagnostics detached_students = row_count;

  delete from public.classrooms
  where id = target_classroom_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'classroom_id', target_classroom_id,
    'workspace_id', target_workspace_id,
    'name', target_name,
    'detached_students', detached_students
  );
end;
$$;

create or replace function public.delete_workspace_safely(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
  classroom_count integer := 0;
  student_count integer := 0;
  member_count integer := 0;
  deleted_rows integer := 0;
begin
  select w.name
    into target_name
  from public.workspaces w
  where w.id = target_workspace_id;

  if target_name is null then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'workspace_id', target_workspace_id
    );
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not allowed to delete workspace'
      using errcode = '42501';
  end if;

  select count(*) into classroom_count
  from public.classrooms
  where workspace_id = target_workspace_id;

  select count(*) into student_count
  from public.students
  where workspace_id = target_workspace_id;

  select count(*) into member_count
  from public.workspace_memberships
  where workspace_id = target_workspace_id;

  delete from public.workspaces
  where id = target_workspace_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'workspace_id', target_workspace_id,
    'name', target_name,
    'counts', jsonb_build_object(
      'classrooms', classroom_count,
      'students', student_count,
      'members', member_count
    )
  );
end;
$$;

grant execute on function public.delete_classroom_safely(uuid) to authenticated;
grant execute on function public.delete_workspace_safely(uuid) to authenticated;
