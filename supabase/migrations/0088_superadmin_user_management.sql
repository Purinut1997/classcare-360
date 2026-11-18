-- 0088_superadmin_user_management.sql
-- Comprehensive Superadmin User Management RPCs:
-- 1. Full user directory with Auth status (email confirmed, last sign-in, banned) & workspace memberships
-- 2. Update user profile (display name, phone)
-- 3. Direct password reset by Superadmin (bcrypt compatible with Supabase GoTrue)
-- 4. Instant email confirmation by Superadmin
-- 5. Suspend / restore account (both public.profiles and auth.users.banned_until)
-- 6. Remove user from a workspace
-- 7. FK-safe permanent user deletion with workspace ownership transfer or cascade delete

-- Ensure pgcrypto is available for bcrypt hashing in extensions schema
create extension if not exists pgcrypto with schema extensions;

-- 1. Full User Directory
create or replace function public.superadmin_list_users_directory(search_text text default null)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  phone text,
  account_status text,
  created_at timestamptz,
  last_login_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  admin_level text,
  is_admin_active boolean,
  workspace_count integer,
  owned_workspace_count integer,
  workspaces jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_search text := lower(trim(coalesce(search_text, '')));
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  return query
  with combined_memberships as (
    select
      wm.profile_id,
      w.id as workspace_id,
      w.name as workspace_name,
      coalesce(nullif(trim(w.school_name), ''), w.name) as school_name,
      wm.role,
      wm.status,
      (w.owner_profile_id = wm.profile_id) as is_owner,
      w.created_at as ws_created_at
    from public.workspace_memberships wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.status <> 'removed'
      and w.archived_at is null
    union
    select
      w.owner_profile_id as profile_id,
      w.id as workspace_id,
      w.name as workspace_name,
      coalesce(nullif(trim(w.school_name), ''), w.name) as school_name,
      'teacher_owner'::text as role,
      'active'::text as status,
      true as is_owner,
      w.created_at as ws_created_at
    from public.workspaces w
    where w.archived_at is null
      and not exists (
        select 1 from public.workspace_memberships wm2
        where wm2.workspace_id = w.id
          and wm2.profile_id = w.owner_profile_id
          and wm2.status <> 'removed'
      )
  ),
  membership_agg as (
    select
      cm.profile_id,
      count(distinct cm.workspace_id)::integer as ws_count,
      count(distinct case when cm.is_owner then cm.workspace_id end)::integer as owned_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'workspace_id', cm.workspace_id,
            'workspace_name', cm.workspace_name,
            'school_name', cm.school_name,
            'role', cm.role,
            'status', cm.status,
            'is_owner', cm.is_owner
          )
          order by cm.is_owner desc, cm.ws_created_at asc
        ),
        '[]'::jsonb
      ) as ws_list
    from combined_memberships cm
    group by cm.profile_id
  )
  select
    p.id as profile_id,
    coalesce(u.email, p.email) as email,
    coalesce(nullif(trim(p.display_name), ''), coalesce(u.email, p.email)) as display_name,
    p.phone,
    p.account_status,
    coalesce(p.created_at, u.created_at) as created_at,
    p.last_login_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    sap.level as admin_level,
    coalesce(sap.is_active, false) as is_admin_active,
    coalesce(ma.ws_count, 0) as workspace_count,
    coalesce(ma.owned_count, 0) as owned_workspace_count,
    coalesce(ma.ws_list, '[]'::jsonb) as workspaces
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.superadmin_profiles sap on sap.profile_id = p.id
  left join membership_agg ma on ma.profile_id = p.id
  where normalized_search = ''
     or lower(coalesce(u.email, p.email, '')) like '%' || normalized_search || '%'
     or lower(coalesce(p.display_name, '')) like '%' || normalized_search || '%'
     or lower(coalesce(p.phone, '')) like '%' || normalized_search || '%'
     or lower(coalesce(ma.ws_list::text, '')) like '%' || normalized_search || '%'
  order by
    coalesce(sap.is_active, false) desc,
    coalesce(p.created_at, u.created_at) desc
  limit 500;
end;
$$;

-- 2. Update User Profile (Display Name & Phone)
create or replace function public.superadmin_update_user_profile(
  target_profile_id uuid,
  next_display_name text,
  next_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cleaned_name text := nullif(trim(coalesce(next_display_name, '')), '');
  cleaned_phone text := nullif(trim(coalesce(next_phone, '')), '');
  updated_row public.profiles%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if cleaned_name is null then
    raise exception 'display_name_required';
  end if;

  update public.profiles
  set
    display_name = cleaned_name,
    phone = cleaned_phone,
    updated_at = now()
  where id = target_profile_id
  returning * into updated_row;

  if not found then
    raise exception 'profile_not_found';
  end if;

  -- Also sync raw_user_meta_data.display_name in auth.users
  update auth.users
  set
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', cleaned_name),
    updated_at = now()
  where id = target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    auth.uid(), 'profiles', target_profile_id, 'superadmin_user_profile_updated', 'normal',
    jsonb_build_object('display_name', cleaned_name, 'phone', cleaned_phone)
  );

  return jsonb_build_object(
    'updated', true,
    'profile_id', updated_row.id,
    'display_name', updated_row.display_name,
    'phone', updated_row.phone
  );
end;
$$;

-- 3. Direct Password Reset by Superadmin
create or replace function public.superadmin_set_user_password(
  target_profile_id uuid,
  next_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_email text;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if next_password is null or length(next_password) < 8 then
    raise exception 'password_too_short';
  end if;

  select email into target_email
  from auth.users
  where id = target_profile_id;

  if target_email is null then
    raise exception 'auth_user_not_found';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(next_password, extensions.gen_salt('bf', 10)),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    recovery_token = '',
    updated_at = now()
  where id = target_profile_id;

  -- Revoke existing refresh tokens / sessions so old sessions are invalidated
  delete from auth.sessions where user_id = target_profile_id;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    auth.uid(), 'profiles', target_profile_id, 'superadmin_password_reset_direct', 'high',
    jsonb_build_object('target_email', target_email)
  );

  return jsonb_build_object(
    'updated', true,
    'profile_id', target_profile_id,
    'email', target_email
  );
end;
$$;

-- 4. Instant Email Confirmation by Superadmin
create or replace function public.superadmin_confirm_user_email(
  target_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_email text;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  update auth.users
  set
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = '',
    updated_at = now()
  where id = target_profile_id
  returning email into target_email;

  if target_email is null then
    raise exception 'auth_user_not_found';
  end if;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    auth.uid(), 'profiles', target_profile_id, 'superadmin_email_confirmed', 'normal',
    jsonb_build_object('target_email', target_email)
  );

  return jsonb_build_object(
    'confirmed', true,
    'profile_id', target_profile_id,
    'email', target_email
  );
end;
$$;

-- 5. Suspend / Restore User Account (Both profiles.account_status & auth.users.banned_until)
create or replace function public.superadmin_set_user_status(
  target_profile_id uuid,
  next_account_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_email text;
  active_superadmin_count integer := 0;
  is_target_superadmin boolean := false;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if next_account_status not in ('registered', 'pending_approval', 'trial', 'active', 'expired', 'suspended', 'cancelled') then
    raise exception 'invalid_account_status';
  end if;

  if target_profile_id = auth.uid() and next_account_status in ('suspended', 'cancelled') then
    raise exception 'cannot_disable_yourself';
  end if;

  if next_account_status in ('suspended', 'cancelled') then
    select exists(
      select 1 from public.superadmin_profiles
      where profile_id = target_profile_id and level = 'superadmin' and is_active = true
    ) into is_target_superadmin;

    if is_target_superadmin then
      select count(*) into active_superadmin_count
      from public.superadmin_profiles
      where level = 'superadmin' and is_active = true and profile_id <> target_profile_id;

      if active_superadmin_count = 0 then
        raise exception 'cannot_disable_last_superadmin';
      end if;
    end if;
  end if;

  update public.profiles
  set
    account_status = next_account_status,
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_superadmin_status_change_at', now(),
      'last_superadmin_status_changed_by', auth.uid()
    )
  where id = target_profile_id
  returning email into target_email;

  if target_email is null then
    raise exception 'profile_not_found';
  end if;

  if next_account_status in ('suspended', 'cancelled') then
    update auth.users
    set banned_until = '2099-12-31 23:59:59+00'::timestamptz, updated_at = now()
    where id = target_profile_id;
    delete from auth.sessions where user_id = target_profile_id;
  else
    update auth.users
    set banned_until = null, updated_at = now()
    where id = target_profile_id;
  end if;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    auth.uid(), 'profiles', target_profile_id,
    case when next_account_status in ('suspended', 'cancelled') then 'superadmin_user_suspended' else 'superadmin_user_restored' end,
    'high',
    jsonb_build_object('target_email', target_email, 'next_account_status', next_account_status)
  );

  return jsonb_build_object(
    'updated', true,
    'profile_id', target_profile_id,
    'email', target_email,
    'account_status', next_account_status
  );
end;
$$;

-- 6. Remove User from a Specific Workspace
create or replace function public.superadmin_remove_user_from_workspace(
  target_profile_id uuid,
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_owner uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  select owner_profile_id into ws_owner
  from public.workspaces
  where id = target_workspace_id;

  if ws_owner = target_profile_id then
    raise exception 'cannot_remove_workspace_owner';
  end if;

  delete from public.workspace_memberships
  where profile_id = target_profile_id
    and workspace_id = target_workspace_id;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'workspace_memberships', target_profile_id,
    'superadmin_workspace_member_removed', 'high',
    jsonb_build_object('target_profile_id', target_profile_id, 'target_workspace_id', target_workspace_id)
  );

  return jsonb_build_object('removed', true);
end;
$$;

-- 7. FK-Safe User Deletion Preparation & Execution
-- workspace_strategy: 'transfer' (default: transfer owned workspaces to actor), 'delete' (delete owned workspaces), 'block' (abort if owns workspaces)
create or replace function public.superadmin_prepare_delete_user(
  target_profile_id uuid,
  workspace_strategy text default 'transfer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_email text;
  active_superadmin_count integer := 0;
  is_target_superadmin boolean := false;
  owned_ws record;
  owned_ws_count integer := 0;
  fk_rec record;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if target_profile_id = actor_id then
    raise exception 'cannot_delete_yourself';
  end if;

  if workspace_strategy not in ('transfer', 'delete', 'block') then
    raise exception 'invalid_workspace_strategy';
  end if;

  select email into target_email
  from public.profiles
  where id = target_profile_id;

  if target_email is null then
    raise exception 'profile_not_found';
  end if;

  select exists(
    select 1 from public.superadmin_profiles
    where profile_id = target_profile_id and level = 'superadmin' and is_active = true
  ) into is_target_superadmin;

  if is_target_superadmin then
    select count(*) into active_superadmin_count
    from public.superadmin_profiles
    where level = 'superadmin' and is_active = true and profile_id <> target_profile_id;

    if active_superadmin_count = 0 then
      raise exception 'cannot_delete_last_superadmin';
    end if;
  end if;

  select count(*) into owned_ws_count
  from public.workspaces
  where owner_profile_id = target_profile_id;

  if owned_ws_count > 0 and workspace_strategy = 'block' then
    return jsonb_build_object(
      'prepared', false,
      'reason', 'owns_workspaces',
      'owned_workspace_count', owned_ws_count
    );
  end if;

  -- Handle owned workspaces according to chosen strategy
  for owned_ws in
    select id, name from public.workspaces where owner_profile_id = target_profile_id
  loop
    if workspace_strategy = 'delete' then
      -- Cascade-delete workspace cleanly
      delete from public.workspaces where id = owned_ws.id;
    else
      -- Transfer ownership to the SuperAdmin executing the deletion
      update public.workspaces
      set owner_profile_id = actor_id, updated_at = now()
      where id = owned_ws.id;

      insert into public.workspace_memberships (workspace_id, profile_id, role, status)
      values (owned_ws.id, actor_id, 'teacher_owner', 'active')
      on conflict (workspace_id, profile_id)
      do update set role = 'teacher_owner', status = 'active';
    end if;
  end loop;

  -- Clean up satellite user-owned rows that should not be reassigned
  delete from public.superadmin_profiles where profile_id = target_profile_id;
  delete from public.workspace_memberships where profile_id = target_profile_id;
  if to_regclass('public.referrals') is not null then
    execute 'delete from public.referrals where referrer_profile_id = $1 or referred_profile_id = $1' using target_profile_id;
  end if;
  if to_regclass('public.affiliate_profiles') is not null then
    execute 'delete from public.affiliate_profiles where profile_id = $1' using target_profile_id;
  end if;
  if to_regclass('public.payment_requests') is not null then
    execute 'delete from public.payment_requests where profile_id = $1' using target_profile_id;
  end if;

  -- Dynamically clear/reassign ANY remaining NO ACTION / RESTRICT FK referencing public.profiles(id)
  for fk_rec in
    select
      ns.nspname as schema_name,
      cls.relname as table_name,
      att.attname as column_name,
      att.attnotnull as is_not_null
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = 'public.profiles'::regclass
      and con.confdeltype in ('a', 'r')
      and array_length(con.conkey, 1) = 1
      and ns.nspname = 'public'
  loop
    if fk_rec.is_not_null then
      -- Reassign required creator/owner reference to the executing SuperAdmin so classroom data stays intact
      execute format(
        'update %I.%I set %I = $1 where %I = $2',
        fk_rec.schema_name, fk_rec.table_name, fk_rec.column_name, fk_rec.column_name
      ) using actor_id, target_profile_id;
    else
      execute format(
        'update %I.%I set %I = null where %I = $1',
        fk_rec.schema_name, fk_rec.table_name, fk_rec.column_name, fk_rec.column_name
      ) using target_profile_id;
    end if;
  end loop;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    actor_id, 'profiles', target_profile_id, 'superadmin_user_deleted', 'high',
    jsonb_build_object(
      'target_email', target_email,
      'workspace_strategy', workspace_strategy,
      'owned_workspace_count', owned_ws_count
    )
  );

  return jsonb_build_object(
    'prepared', true,
    'profile_id', target_profile_id,
    'email', target_email,
    'owned_workspace_count', owned_ws_count,
    'workspace_strategy', workspace_strategy
  );
end;
$$;

-- 8. Full Permanent User Deletion (SQL RPC path — deletes both auth.users & public.profiles)
create or replace function public.superadmin_delete_user_account(
  target_profile_id uuid,
  workspace_strategy text default 'transfer'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  prep jsonb;
begin
  prep := public.superadmin_prepare_delete_user(target_profile_id, workspace_strategy);
  if coalesce((prep->>'prepared')::boolean, false) = false then
    return prep;
  end if;

  -- Delete sessions & auth user (cascades to public.profiles)
  delete from auth.sessions where user_id = target_profile_id;
  delete from auth.users where id = target_profile_id;
  -- Fallback in case profile existed without auth.users row
  delete from public.profiles where id = target_profile_id;

  return prep || jsonb_build_object('deleted', true);
end;
$$;

-- Permissions: authenticated only (all functions verify public.is_superadmin() internally)
revoke all on function public.superadmin_list_users_directory(text) from public;
grant execute on function public.superadmin_list_users_directory(text) to authenticated;

revoke all on function public.superadmin_update_user_profile(uuid, text, text) from public;
grant execute on function public.superadmin_update_user_profile(uuid, text, text) to authenticated;

revoke all on function public.superadmin_set_user_password(uuid, text) from public;
grant execute on function public.superadmin_set_user_password(uuid, text) to authenticated;

revoke all on function public.superadmin_confirm_user_email(uuid) from public;
grant execute on function public.superadmin_confirm_user_email(uuid) to authenticated;

revoke all on function public.superadmin_set_user_status(uuid, text) from public;
grant execute on function public.superadmin_set_user_status(uuid, text) to authenticated;

revoke all on function public.superadmin_remove_user_from_workspace(uuid, uuid) from public;
grant execute on function public.superadmin_remove_user_from_workspace(uuid, uuid) to authenticated;

revoke all on function public.superadmin_prepare_delete_user(uuid, text) from public;
grant execute on function public.superadmin_prepare_delete_user(uuid, text) to authenticated;

revoke all on function public.superadmin_delete_user_account(uuid, text) from public;
grant execute on function public.superadmin_delete_user_account(uuid, text) to authenticated;

notify pgrst, 'reload schema';
