-- Let workspace owners choose what happens to active students when a classroom
-- is permanently removed. The operation is transactional so students cannot
-- be left in a half-updated state if the classroom delete fails.

create or replace function public.delete_classroom_with_student_strategy(
  target_classroom_id uuid,
  student_strategy text default 'detach'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_name text;
  affected_students integer := 0;
  deleted_rows integer := 0;
begin
  if student_strategy not in ('detach', 'archive') then
    raise exception 'invalid student strategy'
      using errcode = '22023';
  end if;

  select c.workspace_id, c.name
    into target_workspace_id, target_name
  from public.classrooms c
  where c.id = target_classroom_id
  for update;

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

  if student_strategy = 'archive' then
    update public.students
    set classroom_id = null,
        status = 'archived'
    where workspace_id = target_workspace_id
      and classroom_id = target_classroom_id;
  else
    update public.students
    set classroom_id = null
    where workspace_id = target_workspace_id
      and classroom_id = target_classroom_id;
  end if;
  get diagnostics affected_students = row_count;

  delete from public.classrooms
  where id = target_classroom_id
    and workspace_id = target_workspace_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'classroom_id', target_classroom_id,
    'workspace_id', target_workspace_id,
    'name', target_name,
    'student_strategy', student_strategy,
    'affected_students', affected_students
  );
end;
$$;

revoke all on function public.delete_classroom_with_student_strategy(uuid, text) from public;
grant execute on function public.delete_classroom_with_student_strategy(uuid, text) to authenticated;
