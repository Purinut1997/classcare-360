-- 0090_fix_superadmin_users_directory_and_hardening.sql
-- Fixes PostgreSQL 42804 ("structure of query does not match function result type")
-- in public.superadmin_list_users_directory caused by auth.users.email being varchar(255)
-- instead of text, and hardens profile upsert & FK-safe user deletion.

-- 1. Fixed Full User Directory (explicit casts on every output column)
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
      wm.profile_id::uuid as profile_id,
      w.id::uuid as workspace_id,
      w.name::text as workspace_name,
      coalesce(nullif(trim(w.school_name), ''), w.name)::text as school_name,
      wm.role::text as role,
      wm.status::text as status,
      (w.owner_profile_id = wm.profile_id)::boolean as is_owner,
      w.created_at::timestamptz as ws_created_at
    from public.workspace_memberships wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.status <> 'removed'
      and w.archived_at is null
    union
    select
      w.owner_profile_id::uuid as profile_id,
      w.id::uuid as workspace_id,
      w.name::text as workspace_name,
      coalesce(nullif(trim(w.school_name), ''), w.name)::text as school_name,
      'teacher_owner'::text as role,
      'active'::text as status,
      true::boolean as is_owner,
      w.created_at::timestamptz as ws_created_at
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
      )::jsonb as ws_list
    from combined_memberships cm
    group by cm.profile_id
  )
  select
    p.id::uuid as profile_id,
    coalesce(u.email::text, p.email::text, '')::text as email,
    coalesce(nullif(trim(p.display_name), ''), u.email::text, p.email::text, '')::text as display_name,
    p.phone::text as phone,
    coalesce(p.account_status::text, 'active')::text as account_status,
    coalesce(p.created_at, u.created_at)::timestamptz as created_at,
    p.last_login_at::timestamptz as last_login_at,
    u.last_sign_in_at::timestamptz as last_sign_in_at,
    u.email_confirmed_at::timestamptz as email_confirmed_at,
    u.banned_until::timestamptz as banned_until,
    sap.level::text as admin_level,
    coalesce(sap.is_active, false)::boolean as is_admin_active,
    coalesce(ma.ws_count, 0)::integer as workspace_count,
    coalesce(ma.owned_count, 0)::integer as owned_workspace_count,
    coalesce(ma.ws_list, '[]'::jsonb)::jsonb as workspaces
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.superadmin_profiles sap on sap.profile_id = p.id
  left join membership_agg ma on ma.profile_id = p.id
  where normalized_search = ''
     or lower(coalesce(u.email::text, p.email::text, '')) like '%' || normalized_search || '%'
     or lower(coalesce(p.display_name::text, '')) like '%' || normalized_search || '%'
     or lower(coalesce(p.phone::text, '')) like '%' || normalized_search || '%'
     or lower(coalesce(ma.ws_list::text, '')) like '%' || normalized_search || '%'
  order by
    coalesce(sap.is_active, false) desc,
    coalesce(p.created_at, u.created_at) desc
  limit 500;
end;
$$;

-- 2. Harden Update User Profile (auto-create missing profile row from auth.users if needed)
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
  auth_email text;
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
    select email::text into auth_email from auth.users where id = target_profile_id;
    if auth_email is null then
      raise exception 'profile_not_found';
    end if;

    insert into public.profiles (id, email, display_name, phone, account_status)
    values (target_profile_id, auth_email, cleaned_name, cleaned_phone, 'active')
    on conflict (id) do update
      set display_name = excluded.display_name,
          phone = excluded.phone,
          updated_at = now()
    returning * into updated_row;
  end if;

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

-- 3. Harden FK-safe User Deletion Preparation against unique_violation & auth.users FKs
create or replace function public.superadmin_prepare_delete_user(
  target_profile_id uuid,
  workspace_strategy text default 'transfer'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
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

  select coalesce(p.email::text, u.email::text) into target_email
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = target_profile_id;

  if target_email is null then
    select email::text into target_email from auth.users where id = target_profile_id;
  end if;

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

  for owned_ws in
    select id, name from public.workspaces where owner_profile_id = target_profile_id
  loop
    if workspace_strategy = 'delete' then
      delete from public.workspaces where id = owned_ws.id;
    else
      update public.workspaces
      set owner_profile_id = actor_id, updated_at = now()
      where id = owned_ws.id;

      insert into public.workspace_memberships (workspace_id, profile_id, role, status)
      values (owned_ws.id, actor_id, 'teacher_owner', 'active')
      on conflict (workspace_id, profile_id)
      do update set role = 'teacher_owner', status = 'active';
    end if;
  end loop;

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
      and con.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and con.confdeltype in ('a', 'r')
      and array_length(con.conkey, 1) = 1
      and ns.nspname = 'public'
      and cls.relname <> 'profiles'
  loop
    if fk_rec.is_not_null then
      begin
        execute format(
          'update %I.%I set %I = $1 where %I = $2',
          fk_rec.schema_name, fk_rec.table_name, fk_rec.column_name, fk_rec.column_name
        ) using actor_id, target_profile_id;
      exception when unique_violation then
        execute format(
          'delete from %I.%I where %I = $1',
          fk_rec.schema_name, fk_rec.table_name, fk_rec.column_name
        ) using target_profile_id;
      end;
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

revoke all on function public.superadmin_list_users_directory(text) from public;
grant execute on function public.superadmin_list_users_directory(text) to authenticated;

revoke all on function public.superadmin_update_user_profile(uuid, text, text) from public;
grant execute on function public.superadmin_update_user_profile(uuid, text, text) to authenticated;

revoke all on function public.superadmin_prepare_delete_user(uuid, text) from public;
grant execute on function public.superadmin_prepare_delete_user(uuid, text) to authenticated;

notify pgrst, 'reload schema';
