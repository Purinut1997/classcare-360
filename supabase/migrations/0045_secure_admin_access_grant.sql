-- Add or reactivate Admin/SuperAdmin through one audited server-side operation.
-- Direct client writes to superadmin_profiles remain protected by RLS.

create or replace function public.grant_admin_access_by_email(
  target_email text,
  target_level text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_profile public.profiles%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if target_level not in ('admin', 'superadmin') then
    raise exception 'invalid_admin_level';
  end if;

  select p.*
  into target_profile
  from public.profiles p
  where lower(p.email) = normalized_email
  limit 1;

  if target_profile.id is null then
    return jsonb_build_object('granted', false, 'reason', 'profile_not_found');
  end if;

  insert into public.superadmin_profiles (
    profile_id,
    level,
    is_active,
    created_by
  )
  values (
    target_profile.id,
    target_level,
    true,
    auth.uid()
  )
  on conflict (profile_id) do update
  set level = excluded.level,
      is_active = true;

  insert into public.audit_logs (
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    metadata
  )
  values (
    auth.uid(),
    'superadmin_profiles',
    target_profile.id,
    'admin_access_granted',
    jsonb_build_object(
      'email', target_profile.email,
      'level', target_level,
      'lifetime_vip', true
    )
  );

  return jsonb_build_object(
    'granted', true,
    'profile_id', target_profile.id,
    'email', target_profile.email,
    'display_name', coalesce(target_profile.display_name, target_profile.email),
    'level', target_level
  );
end;
$$;

revoke all on function public.grant_admin_access_by_email(text, text) from public;
grant execute on function public.grant_admin_access_by_email(text, text) to authenticated;
