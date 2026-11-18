-- 0089_superadmin_update_email_rpc.sql
-- Allow SuperAdmins to update a user's login email directly across auth.users, auth.identities, and public.profiles.

create or replace function public.superadmin_update_user_email(
  target_profile_id uuid,
  next_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cleaned_email text := lower(trim(coalesce(next_email, '')));
  previous_email text;
  conflict_exists boolean := false;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if cleaned_email = '' or position('@' in cleaned_email) < 2 then
    raise exception 'invalid_email';
  end if;

  select email into previous_email
  from auth.users
  where id = target_profile_id;

  if previous_email is null then
    raise exception 'auth_user_not_found';
  end if;

  if lower(previous_email) = cleaned_email then
    return jsonb_build_object('updated', false, 'email', cleaned_email);
  end if;

  select exists(
    select 1 from auth.users
    where lower(email) = cleaned_email and id <> target_profile_id
  ) into conflict_exists;

  if conflict_exists then
    raise exception 'email_already_in_use';
  end if;

  update auth.users
  set
    email = cleaned_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    email_change = '',
    email_change_token_new = '',
    updated_at = now()
  where id = target_profile_id;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', cleaned_email),
    updated_at = now()
  where user_id = target_profile_id
    and provider = 'email';

  update public.profiles
  set
    email = cleaned_email,
    updated_at = now()
  where id = target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    auth.uid(), 'profiles', target_profile_id, 'superadmin_user_email_updated', 'high',
    jsonb_build_object('previous_email', previous_email, 'next_email', cleaned_email)
  );

  return jsonb_build_object(
    'updated', true,
    'profile_id', target_profile_id,
    'previous_email', previous_email,
    'email', cleaned_email
  );
end;
$$;

revoke all on function public.superadmin_update_user_email(uuid, text) from public;
grant execute on function public.superadmin_update_user_email(uuid, text) to authenticated;

notify pgrst, 'reload schema';
