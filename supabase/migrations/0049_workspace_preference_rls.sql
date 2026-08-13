-- Workspace preferences may only point to a workspace the user can access.

drop policy if exists "profile_workspace_preferences_update_self_or_superadmin"
  on public.profile_workspace_preferences;

create policy "profile_workspace_preferences_update_self_or_superadmin"
on public.profile_workspace_preferences for update to authenticated
using (profile_id = auth.uid() or public.is_superadmin())
with check (
  public.is_superadmin()
  or (
    profile_id = auth.uid()
    and (primary_workspace_id is null or public.is_workspace_member(primary_workspace_id))
    and (last_active_workspace_id is null or public.is_workspace_member(last_active_workspace_id))
  )
);
