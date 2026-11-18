-- 0091_superadmin_control_center_suite.sql
-- Complete Superadmin Operations Suite backend:
-- 1. Database-backed Global Broadcasts & Maintenance Mode (replaces localStorage-only broadcast)
-- 2. Workspace management RPCs (edit info & feature flags, list/add members, transfer ownership, revoke VIP)
-- 3. Cross-workspace Audit Logs listing RPC for Superadmin
-- 4. Live System Diagnostics & Platform Usage Analytics RPC
-- 5. Instant Workspace JSON Snapshot Export RPC

-- ============================================================================
-- 1. Global System Broadcasts & Maintenance Mode
-- ============================================================================
create table if not exists public.system_broadcasts (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'maintenance')),
  title text not null,
  message text not null default '',
  link_text text,
  link_url text,
  dismissible boolean not null default true,
  maintenance_lock boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_broadcasts enable row level security;

drop policy if exists "Anyone authenticated can read active system broadcasts" on public.system_broadcasts;
create policy "Anyone authenticated can read active system broadcasts"
  on public.system_broadcasts
  for select
  to authenticated, anon
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "Superadmin can manage system broadcasts" on public.system_broadcasts;
create policy "Superadmin can manage system broadcasts"
  on public.system_broadcasts
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create or replace function public.get_active_system_broadcast()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.system_broadcasts%rowtype;
begin
  select *
  into rec
  from public.system_broadcasts
  where is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  order by updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', rec.id,
    'isActive', rec.is_active,
    'severity', rec.severity,
    'title', rec.title,
    'message', rec.message,
    'linkText', coalesce(rec.link_text, ''),
    'linkUrl', coalesce(rec.link_url, ''),
    'dismissible', rec.dismissible,
    'maintenanceLock', rec.maintenance_lock,
    'startsAt', rec.starts_at,
    'endsAt', rec.ends_at,
    'createdAt', rec.created_at,
    'updatedAt', rec.updated_at
  );
end;
$$;

create or replace function public.superadmin_upsert_system_broadcast(
  p_is_active boolean,
  p_severity text,
  p_title text,
  p_message text default '',
  p_link_text text default null,
  p_link_url text default null,
  p_dismissible boolean default true,
  p_maintenance_lock boolean default false,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_title text := trim(coalesce(p_title, ''));
  cleaned_message text := trim(coalesce(p_message, ''));
  cleaned_severity text := case when p_severity in ('info', 'warning', 'maintenance') then p_severity else 'info' end;
  rec public.system_broadcasts%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if p_is_active and cleaned_title = '' then
    raise exception 'title_required';
  end if;

  -- Deactivate previous active broadcasts so only one active global banner exists
  update public.system_broadcasts
  set is_active = false, updated_at = now(), updated_by = auth.uid()
  where is_active = true;

  insert into public.system_broadcasts (
    is_active,
    severity,
    title,
    message,
    link_text,
    link_url,
    dismissible,
    maintenance_lock,
    starts_at,
    ends_at,
    updated_by
  ) values (
    coalesce(p_is_active, false),
    cleaned_severity,
    coalesce(nullif(cleaned_title, ''), 'ประกาศจากระบบ'),
    cleaned_message,
    nullif(trim(coalesce(p_link_text, '')), ''),
    nullif(trim(coalesce(p_link_url, '')), ''),
    case when coalesce(p_maintenance_lock, false) then false else coalesce(p_dismissible, true) end,
    coalesce(p_maintenance_lock, false),
    p_starts_at,
    p_ends_at,
    auth.uid()
  )
  returning * into rec;

  insert into public.audit_logs (
    actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    auth.uid(),
    'system_broadcasts',
    rec.id,
    case when rec.maintenance_lock and rec.is_active then 'superadmin_maintenance_mode_enabled'
         when rec.is_active then 'superadmin_broadcast_published'
         else 'superadmin_broadcast_saved_inactive' end,
    case when rec.maintenance_lock and rec.is_active then 'high' else 'normal' end,
    jsonb_build_object(
      'title', rec.title,
      'severity', rec.severity,
      'is_active', rec.is_active,
      'maintenance_lock', rec.maintenance_lock
    )
  );

  return jsonb_build_object(
    'id', rec.id,
    'isActive', rec.is_active,
    'severity', rec.severity,
    'title', rec.title,
    'message', rec.message,
    'linkText', coalesce(rec.link_text, ''),
    'linkUrl', coalesce(rec.link_url, ''),
    'dismissible', rec.dismissible,
    'maintenanceLock', rec.maintenance_lock,
    'startsAt', rec.starts_at,
    'endsAt', rec.ends_at,
    'createdAt', rec.created_at,
    'updatedAt', rec.updated_at
  );
end;
$$;

create or replace function public.superadmin_clear_system_broadcast()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  update public.system_broadcasts
  set is_active = false, maintenance_lock = false, updated_at = now(), updated_by = auth.uid()
  where is_active = true or maintenance_lock = true;

  insert into public.audit_logs (
    actor_profile_id, entity_table, action, risk_level, metadata
  ) values (
    auth.uid(), 'system_broadcasts', 'superadmin_broadcast_cleared', 'normal', '{}'::jsonb
  );

  return jsonb_build_object('cleared', true);
end;
$$;

-- ============================================================================
-- 2. Superadmin Workspace Operations (Edit, Feature Flags, Members, Transfer, VIP Revoke)
-- ============================================================================
create or replace function public.superadmin_update_workspace(
  target_workspace_id uuid,
  next_name text,
  next_school_name text default null,
  next_academic_year text default null,
  next_feature_flags jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_name text := nullif(trim(coalesce(next_name, '')), '');
  cleaned_school text := nullif(trim(coalesce(next_school_name, '')), '');
  cleaned_year text := nullif(trim(coalesce(next_academic_year, '')), '');
  updated_ws public.workspaces%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if cleaned_name is null then
    raise exception 'workspace_name_required';
  end if;

  update public.workspaces
  set
    name = cleaned_name,
    school_name = coalesce(cleaned_school, school_name),
    academic_year = coalesce(cleaned_year, academic_year),
    settings = case
      when next_feature_flags is not null then
        coalesce(settings, '{}'::jsonb) || jsonb_build_object('feature_flags', next_feature_flags)
      else settings
    end,
    updated_at = now()
  where id = target_workspace_id
  returning * into updated_ws;

  if not found then
    raise exception 'workspace_not_found';
  end if;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'workspaces', target_workspace_id,
    'superadmin_workspace_updated', 'normal',
    jsonb_build_object(
      'name', updated_ws.name,
      'school_name', updated_ws.school_name,
      'academic_year', updated_ws.academic_year,
      'feature_flags', next_feature_flags
    )
  );

  return jsonb_build_object(
    'updated', true,
    'id', updated_ws.id,
    'name', updated_ws.name,
    'school_name', updated_ws.school_name,
    'academic_year', updated_ws.academic_year,
    'settings', updated_ws.settings
  );
end;
$$;

create or replace function public.superadmin_list_workspace_members(
  target_workspace_id uuid
)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  is_owner boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  return query
  with ws_owner as (
    select w.owner_profile_id
    from public.workspaces w
    where w.id = target_workspace_id
  ),
  combined as (
    select
      wm.profile_id::uuid as profile_id,
      wm.role::text as role,
      wm.status::text as status,
      (wm.profile_id = (select owner_profile_id from ws_owner))::boolean as is_owner,
      coalesce(wm.joined_at, wm.created_at)::timestamptz as joined_at
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.status <> 'removed'
    union
    select
      o.owner_profile_id::uuid as profile_id,
      'teacher_owner'::text as role,
      'active'::text as status,
      true::boolean as is_owner,
      w.created_at::timestamptz as joined_at
    from ws_owner o
    join public.workspaces w on w.id = target_workspace_id
    where o.owner_profile_id is not null
      and not exists (
        select 1 from public.workspace_memberships wm2
        where wm2.workspace_id = target_workspace_id
          and wm2.profile_id = o.owner_profile_id
          and wm2.status <> 'removed'
      )
  )
  select
    c.profile_id::uuid,
    coalesce(u.email::text, p.email::text, '')::text as email,
    coalesce(nullif(trim(p.display_name), ''), u.email::text, p.email::text, '')::text as display_name,
    c.role::text,
    c.status::text,
    c.is_owner::boolean,
    c.joined_at::timestamptz
  from combined c
  left join public.profiles p on p.id = c.profile_id
  left join auth.users u on u.id = c.profile_id
  order by c.is_owner desc, c.joined_at asc;
end;
$$;

create or replace function public.superadmin_add_workspace_member(
  target_workspace_id uuid,
  target_profile_id uuid,
  next_role text default 'teacher_member'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_role text := case when next_role in ('teacher_owner', 'teacher_member', 'viewer', 'parent', 'student') then next_role else 'teacher_member' end;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if not exists (select 1 from public.workspaces where id = target_workspace_id) then
    raise exception 'workspace_not_found';
  end if;

  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'profile_not_found';
  end if;

  insert into public.workspace_memberships (
    workspace_id, profile_id, role, status, invited_by, joined_at
  ) values (
    target_workspace_id, target_profile_id, cleaned_role, 'active', auth.uid(), now()
  )
  on conflict (workspace_id, profile_id)
  do update set
    role = excluded.role,
    status = 'active',
    updated_at = now();

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'workspace_memberships', target_profile_id,
    'superadmin_workspace_member_added', 'normal',
    jsonb_build_object('target_profile_id', target_profile_id, 'role', cleaned_role)
  );

  return jsonb_build_object('added', true, 'workspace_id', target_workspace_id, 'profile_id', target_profile_id, 'role', cleaned_role);
end;
$$;

create or replace function public.superadmin_transfer_workspace_owner(
  target_workspace_id uuid,
  next_owner_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prev_owner_id uuid;
  ws_name text;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  select owner_profile_id, name into prev_owner_id, ws_name
  from public.workspaces
  where id = target_workspace_id;

  if ws_name is null then
    raise exception 'workspace_not_found';
  end if;

  if not exists (select 1 from public.profiles where id = next_owner_profile_id) then
    raise exception 'profile_not_found';
  end if;

  update public.workspaces
  set owner_profile_id = next_owner_profile_id, updated_at = now()
  where id = target_workspace_id;

  -- Ensure new owner has teacher_owner membership
  insert into public.workspace_memberships (
    workspace_id, profile_id, role, status, invited_by, joined_at
  ) values (
    target_workspace_id, next_owner_profile_id, 'teacher_owner', 'active', auth.uid(), now()
  )
  on conflict (workspace_id, profile_id)
  do update set role = 'teacher_owner', status = 'active', updated_at = now();

  -- Keep previous owner as teacher_member so they aren't abruptly locked out if still teaching
  if prev_owner_id is not null and prev_owner_id <> next_owner_profile_id then
    update public.workspace_memberships
    set role = 'teacher_member', updated_at = now()
    where workspace_id = target_workspace_id
      and profile_id = prev_owner_id
      and role = 'teacher_owner';
  end if;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'workspaces', target_workspace_id,
    'superadmin_workspace_owner_transferred', 'high',
    jsonb_build_object('previous_owner_id', prev_owner_id, 'next_owner_id', next_owner_profile_id, 'workspace_name', ws_name)
  );

  return jsonb_build_object(
    'transferred', true,
    'workspace_id', target_workspace_id,
    'previous_owner_id', prev_owner_id,
    'next_owner_id', next_owner_profile_id
  );
end;
$$;

create or replace function public.superadmin_revoke_workspace_vip(
  target_workspace_id uuid,
  revoke_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  update public.subscriptions
  set
    status = 'expired',
    ends_at = least(coalesce(ends_at, now()), now()),
    cancelled_at = now(),
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'revoked_by_superadmin', auth.uid(),
      'revoked_at', now(),
      'revoke_reason', coalesce(nullif(trim(revoke_reason), ''), 'ถอดสิทธิ์ VIP โดย SuperAdmin')
    )
  where workspace_id = target_workspace_id
    and status in ('active', 'trial');

  get diagnostics affected_count = row_count;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'subscriptions', target_workspace_id,
    'superadmin_workspace_vip_revoked', 'high',
    jsonb_build_object('affected_count', affected_count, 'reason', revoke_reason)
  );

  return jsonb_build_object('revoked', true, 'affected_count', affected_count);
end;
$$;

-- ============================================================================
-- 3. Cross-Workspace Audit Logs RPC for Superadmin
-- ============================================================================
create or replace function public.superadmin_list_audit_logs(
  search_text text default null,
  risk_filter text default null,
  limit_count integer default 150
)
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  actor_profile_id uuid,
  actor_email text,
  actor_name text,
  action text,
  entity_table text,
  entity_id uuid,
  risk_level text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_search text := lower(trim(coalesce(search_text, '')));
  normalized_risk text := lower(trim(coalesce(risk_filter, '')));
  capped_limit integer := greatest(10, least(coalesce(limit_count, 150), 500));
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  return query
  select
    al.id::uuid,
    al.workspace_id::uuid,
    coalesce(nullif(trim(w.school_name), ''), w.name, 'ระบบส่วนกลาง')::text as workspace_name,
    al.actor_profile_id::uuid,
    coalesce(u.email::text, p.email::text, '')::text as actor_email,
    coalesce(nullif(trim(p.display_name), ''), u.email::text, p.email::text, 'ระบบอัตโนมัติ')::text as actor_name,
    al.action::text,
    coalesce(al.entity_table, '-')::text as entity_table,
    al.entity_id::uuid,
    coalesce(al.risk_level, 'normal')::text as risk_level,
    coalesce(al.metadata, '{}'::jsonb)::jsonb as metadata,
    al.created_at::timestamptz
  from public.audit_logs al
  left join public.workspaces w on w.id = al.workspace_id
  left join public.profiles p on p.id = al.actor_profile_id
  left join auth.users u on u.id = al.actor_profile_id
  where (
      normalized_risk = ''
      or normalized_risk = 'all'
      or (normalized_risk = 'elevated' and al.risk_level in ('high', 'critical'))
      or lower(al.risk_level) = normalized_risk
    )
    and (
      normalized_search = ''
      or lower(coalesce(al.action, '')) like '%' || normalized_search || '%'
      or lower(coalesce(al.entity_table, '')) like '%' || normalized_search || '%'
      or lower(coalesce(u.email::text, p.email::text, '')) like '%' || normalized_search || '%'
      or lower(coalesce(p.display_name, '')) like '%' || normalized_search || '%'
      or lower(coalesce(w.school_name, w.name, '')) like '%' || normalized_search || '%'
      or lower(coalesce(al.metadata::text, '')) like '%' || normalized_search || '%'
    )
  order by al.created_at desc
  limit capped_limit;
end;
$$;

-- ============================================================================
-- 4. Live System Diagnostics & Platform Analytics RPC
-- ============================================================================
create or replace function public.superadmin_get_system_diagnostics()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  total_users integer := 0;
  orphan_users integer := 0;
  unconfirmed_users integer := 0;
  active_7d integer := 0;
  active_30d integer := 0;
  new_users_30d integer := 0;
  total_ws integer := 0;
  active_ws integer := 0;
  total_classrooms integer := 0;
  total_students integer := 0;
  total_attendance integer := 0;
  total_savings_tx integer := 0;
  total_audit_logs integer := 0;
  open_tickets integer := 0;
  urgent_tickets integer := 0;
  pending_payments integer := 0;
  approved_payments integer := 0;
  approved_revenue_thb numeric := 0;
  db_size_bytes bigint := 0;
  buckets_json jsonb := '[]'::jsonb;
  rpcs_json jsonb := '[]'::jsonb;
  rpc_names text[] := array[
    'superadmin_list_users_directory',
    'superadmin_set_user_password',
    'superadmin_delete_user_account',
    'superadmin_update_user_email',
    'superadmin_upsert_system_broadcast',
    'superadmin_list_audit_logs',
    'superadmin_transfer_workspace_owner',
    'superadmin_export_workspace_snapshot',
    'grant_workspace_vip',
    'delete_workspace_safely'
  ];
  fn text;
  fn_exists boolean;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  select count(*) into total_users from public.profiles;

  select count(*) into orphan_users
  from public.profiles p
  where not exists (
    select 1 from public.workspaces w where w.owner_profile_id = p.id and w.archived_at is null
  )
  and not exists (
    select 1 from public.workspace_memberships wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.profile_id = p.id and wm.status <> 'removed' and w.archived_at is null
  );

  select count(*) into unconfirmed_users
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email_confirmed_at is null;

  select count(*) into active_7d
  from auth.users
  where last_sign_in_at >= now() - interval '7 days';

  select count(*) into active_30d
  from auth.users
  where last_sign_in_at >= now() - interval '30 days';

  select count(*) into new_users_30d
  from public.profiles
  where created_at >= now() - interval '30 days';

  select count(*), count(*) filter (where archived_at is null)
  into total_ws, active_ws
  from public.workspaces;

  select count(*) into total_classrooms from public.classrooms;
  select count(*) into total_students from public.students;
  select count(*) into total_audit_logs from public.audit_logs;

  if to_regclass('public.attendance_records') is not null then
    execute 'select count(*) from public.attendance_records' into total_attendance;
  end if;

  if to_regclass('public.savings_transactions') is not null then
    execute 'select count(*) from public.savings_transactions' into total_savings_tx;
  end if;

  if to_regclass('public.support_tickets') is not null then
    execute $q$
      select
        count(*) filter (where status not in ('resolved', 'closed')),
        count(*) filter (where priority = 'urgent' and status not in ('resolved', 'closed'))
      from public.support_tickets
    $q$ into open_tickets, urgent_tickets;
  end if;

  if to_regclass('public.payment_requests') is not null then
    execute $q$
      select
        count(*) filter (where status = 'pending_review'),
        count(*) filter (where status = 'approved'),
        coalesce(sum(payable_amount_thb) filter (where status = 'approved'), 0)
      from public.payment_requests
    $q$ into pending_payments, approved_payments, approved_revenue_thb;
  end if;

  select pg_database_size(current_database()) into db_size_bytes;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'public', b.public
      )
      order by b.name
    ),
    '[]'::jsonb
  )
  into buckets_json
  from storage.buckets b;

  foreach fn in array rpc_names loop
    select exists(
      select 1
      from pg_proc pr
      join pg_namespace ns on ns.oid = pr.pronamespace
      where ns.nspname = 'public' and pr.proname = fn
    ) into fn_exists;
    rpcs_json := rpcs_json || jsonb_build_array(jsonb_build_object('name', fn, 'ok', fn_exists));
  end loop;

  return jsonb_build_object(
    'checked_at', now(),
    'db_size_bytes', db_size_bytes,
    'counts', jsonb_build_object(
      'users', total_users,
      'orphan_users', orphan_users,
      'unconfirmed_users', unconfirmed_users,
      'active_users_7d', active_7d,
      'active_users_30d', active_30d,
      'new_users_30d', new_users_30d,
      'workspaces_total', total_ws,
      'workspaces_active', active_ws,
      'classrooms', total_classrooms,
      'students', total_students,
      'attendance_records', total_attendance,
      'savings_transactions', total_savings_tx,
      'audit_logs', total_audit_logs,
      'open_support_tickets', open_tickets,
      'urgent_support_tickets', urgent_tickets,
      'pending_payments', pending_payments,
      'approved_payments', approved_payments,
      'approved_revenue_thb', approved_revenue_thb
    ),
    'buckets', buckets_json,
    'rpcs', rpcs_json
  );
end;
$$;

-- ============================================================================
-- 5. Instant Workspace JSON Backup Snapshot Export RPC
-- ============================================================================
create or replace function public.superadmin_export_workspace_snapshot(
  target_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_json jsonb;
  members_json jsonb;
  classrooms_json jsonb;
  students_json jsonb;
  savings_accounts_json jsonb := '[]'::jsonb;
  savings_tx_json jsonb := '[]'::jsonb;
  subscriptions_json jsonb := '[]'::jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  select to_jsonb(w) into ws_json from public.workspaces w where w.id = target_workspace_id;
  if ws_json is null then
    raise exception 'workspace_not_found';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) into members_json
  from public.workspace_memberships m where m.workspace_id = target_workspace_id;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into classrooms_json
  from public.classrooms c where c.workspace_id = target_workspace_id;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into students_json
  from public.students s where s.workspace_id = target_workspace_id;

  select coalesce(jsonb_agg(to_jsonb(sub)), '[]'::jsonb) into subscriptions_json
  from public.subscriptions sub where sub.workspace_id = target_workspace_id;

  if to_regclass('public.savings_accounts') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(sa)), ''[]''::jsonb) from public.savings_accounts sa where sa.workspace_id = $1'
      into savings_accounts_json using target_workspace_id;
  end if;

  if to_regclass('public.savings_transactions') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(st)), ''[]''::jsonb) from public.savings_transactions st where st.workspace_id = $1'
      into savings_tx_json using target_workspace_id;
  end if;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'workspaces', target_workspace_id,
    'superadmin_workspace_snapshot_exported', 'normal',
    jsonb_build_object(
      'classroom_count', jsonb_array_length(classrooms_json),
      'student_count', jsonb_array_length(students_json)
    )
  );

  return jsonb_build_object(
    'exported_at', now(),
    'schema_version', 'classcare-360-snapshot-v1',
    'workspace', ws_json,
    'members', members_json,
    'subscriptions', subscriptions_json,
    'classrooms', classrooms_json,
    'students', students_json,
    'savings_accounts', savings_accounts_json,
    'savings_transactions', savings_tx_json
  );
end;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
revoke all on function public.get_active_system_broadcast() from public;
grant execute on function public.get_active_system_broadcast() to authenticated, anon;

revoke all on function public.superadmin_upsert_system_broadcast(boolean, text, text, text, text, text, boolean, boolean, timestamptz, timestamptz) from public;
grant execute on function public.superadmin_upsert_system_broadcast(boolean, text, text, text, text, text, boolean, boolean, timestamptz, timestamptz) to authenticated;

revoke all on function public.superadmin_clear_system_broadcast() from public;
grant execute on function public.superadmin_clear_system_broadcast() to authenticated;

revoke all on function public.superadmin_update_workspace(uuid, text, text, text, jsonb) from public;
grant execute on function public.superadmin_update_workspace(uuid, text, text, text, jsonb) to authenticated;

revoke all on function public.superadmin_list_workspace_members(uuid) from public;
grant execute on function public.superadmin_list_workspace_members(uuid) to authenticated;

revoke all on function public.superadmin_add_workspace_member(uuid, uuid, text) from public;
grant execute on function public.superadmin_add_workspace_member(uuid, uuid, text) to authenticated;

revoke all on function public.superadmin_transfer_workspace_owner(uuid, uuid) from public;
grant execute on function public.superadmin_transfer_workspace_owner(uuid, uuid) to authenticated;

revoke all on function public.superadmin_revoke_workspace_vip(uuid, text) from public;
grant execute on function public.superadmin_revoke_workspace_vip(uuid, text) to authenticated;

revoke all on function public.superadmin_list_audit_logs(text, text, integer) from public;
grant execute on function public.superadmin_list_audit_logs(text, text, integer) to authenticated;

revoke all on function public.superadmin_get_system_diagnostics() from public;
grant execute on function public.superadmin_get_system_diagnostics() to authenticated;

revoke all on function public.superadmin_export_workspace_snapshot(uuid) from public;
grant execute on function public.superadmin_export_workspace_snapshot(uuid) to authenticated;

notify pgrst, 'reload schema';
