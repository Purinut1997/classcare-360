-- ClassCare 360 - allow workspace teachers to write their own audit trail.
-- Audit rows are append-only from the frontend; reads remain limited by existing select policies.

drop policy if exists "audit_logs_insert_workspace_teacher" on public.audit_logs;

create policy "audit_logs_insert_workspace_teacher"
on public.audit_logs
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    workspace_id is not null
    and actor_profile_id = auth.uid()
    and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);
