-- Allow only workspace owners and superadmins to permanently delete imported students.
-- Regular teacher members should archive wrong imports first, not hard-delete shared records.

drop policy if exists "students_delete_owner_or_superadmin" on public.students;

create policy "students_delete_owner_or_superadmin"
on public.students
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);
