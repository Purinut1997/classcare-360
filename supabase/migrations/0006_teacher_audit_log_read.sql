-- ClassCare 360 - allow workspace teachers to read workspace audit logs.
-- Logs contain compact operational metadata only; sensitive form payloads stay in source tables.

drop policy if exists "audit_logs_select_workspace_teacher" on public.audit_logs;

create policy "audit_logs_select_workspace_teacher"
on public.audit_logs
for select
to authenticated
using (
  public.is_superadmin()
  or (
    workspace_id is not null
    and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);
