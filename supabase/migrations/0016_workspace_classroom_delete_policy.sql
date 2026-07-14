-- Allow workspace owners and superadmins to clean up duplicate rooms/workspaces.
-- Classroom deletion keeps students by detaching classroom_id because the FK is on delete set null.
-- Workspace deletion is destructive and follows the cascade rules declared in the schema.

drop policy if exists "classrooms_delete_owner_or_superadmin" on public.classrooms;

create policy "classrooms_delete_owner_or_superadmin"
on public.classrooms
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

drop policy if exists "workspaces_delete_owner_or_superadmin" on public.workspaces;

create policy "workspaces_delete_owner_or_superadmin"
on public.workspaces
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(id, array['teacher_owner'])
);
