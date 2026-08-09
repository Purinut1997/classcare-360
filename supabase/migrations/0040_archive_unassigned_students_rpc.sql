-- Archive active students that are no longer assigned to a classroom.
-- Keep this owner-only at the database boundary because it is a bulk action.

create or replace function public.archive_unassigned_students(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_students integer := 0;
begin
  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not allowed to archive unassigned students'
      using errcode = '42501';
  end if;

  update public.students
  set status = 'archived'
  where workspace_id = target_workspace_id
    and classroom_id is null
    and status = 'active';
  get diagnostics archived_students = row_count;

  return jsonb_build_object(
    'archived', true,
    'workspace_id', target_workspace_id,
    'archived_students', archived_students
  );
end;
$$;

revoke all on function public.archive_unassigned_students(uuid) from public;
grant execute on function public.archive_unassigned_students(uuid) to authenticated;
