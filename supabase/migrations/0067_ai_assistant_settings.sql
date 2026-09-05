-- AI Assistant Settings (Gemini API Key & Model Configuration)
-- Supports School-level Key, Personal Key, and Superadmin Grants

alter table public.workspaces
  add column if not exists gemini_api_key text,
  add column if not exists ai_model text default 'gemini-2.0-flash',
  add column if not exists is_ai_enabled boolean default true;

alter table public.profiles
  add column if not exists personal_gemini_api_key text,
  add column if not exists personal_ai_model text default 'gemini-2.0-flash';

-- Function for Superadmin to grant/set AI Key for any workspace
create or replace function public.set_workspace_ai_key(
  target_workspace_id uuid,
  new_api_key text,
  new_model text default 'gemini-2.0-flash'
)
returns void
language plpgsql
security definer
as $$
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id, array['teacher_owner'])) then
    raise exception 'Permission denied: only superadmin or workspace owner can configure AI settings';
  end if;

  update public.workspaces
  set gemini_api_key = new_api_key,
      ai_model = coalesce(new_model, 'gemini-2.0-flash'),
      is_ai_enabled = true,
      updated_at = now()
  where id = target_workspace_id;
end;
$$;

-- Function for Superadmin to grant AI Key to any teacher profile
create or replace function public.set_profile_ai_key(
  target_profile_id uuid,
  new_api_key text,
  new_model text default 'gemini-2.0-flash'
)
returns void
language plpgsql
security definer
as $$
begin
  if not (public.is_superadmin() or auth.uid() = target_profile_id) then
    raise exception 'Permission denied: only superadmin or profile owner can configure personal AI settings';
  end if;

  update public.profiles
  set personal_gemini_api_key = new_api_key,
      personal_ai_model = coalesce(new_model, 'gemini-2.0-flash'),
      updated_at = now()
  where id = target_profile_id;
end;
$$;

grant execute on function public.set_workspace_ai_key(uuid, text, text) to authenticated;
grant execute on function public.set_profile_ai_key(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
