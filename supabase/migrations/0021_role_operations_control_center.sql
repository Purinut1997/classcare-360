-- ClassCare 360 - role operations used by Superadmin and workspace owners.
-- These RPCs keep sensitive actions behind database-side permission checks so
-- frontend buttons do not depend on broad table update/delete policies.

create or replace function public.set_superadmin_profile_status(
  target_profile_id uuid,
  next_is_active boolean
)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  level text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if target_profile_id = auth.uid() and next_is_active = false then
    raise exception 'cannot_disable_yourself';
  end if;

  update public.superadmin_profiles sp
  set is_active = next_is_active
  where sp.profile_id = target_profile_id;

  if not found then
    raise exception 'superadmin_profile_not_found';
  end if;

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
    target_profile_id,
    case when next_is_active then 'superadmin_access_restored' else 'superadmin_access_disabled' end,
    jsonb_build_object('next_is_active', next_is_active)
  );

  return query
  select
    sp.profile_id,
    p.email,
    coalesce(p.display_name, p.email) as display_name,
    sp.level,
    sp.is_active,
    sp.created_at
  from public.superadmin_profiles sp
  join public.profiles p on p.id = sp.profile_id
  where sp.profile_id = target_profile_id;
end;
$$;

create or replace function public.set_profile_account_status_by_email(
  target_email text,
  next_account_status text
)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  account_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_profile_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if normalized_email = '' then
    raise exception 'email_required';
  end if;

  if next_account_status not in ('registered', 'pending_approval', 'trial', 'active', 'expired', 'suspended', 'cancelled') then
    raise exception 'invalid_account_status';
  end if;

  select p.id
  into target_profile_id
  from public.profiles p
  where lower(p.email) = normalized_email
  limit 1;

  if target_profile_id is null then
    raise exception 'profile_not_found';
  end if;

  if target_profile_id = auth.uid() and next_account_status in ('suspended', 'cancelled') then
    raise exception 'cannot_disable_yourself';
  end if;

  update public.profiles p
  set account_status = next_account_status,
      updated_at = now(),
      metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
        'last_superadmin_status_change_at', now(),
        'last_superadmin_status_changed_by', auth.uid()
      )
  where p.id = target_profile_id;

  insert into public.audit_logs (
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    risk_level,
    metadata
  )
  values (
    auth.uid(),
    'profiles',
    target_profile_id,
    'profile_account_status_changed',
    case when next_account_status in ('suspended', 'cancelled') then 'high' else 'normal' end,
    jsonb_build_object('email', normalized_email, 'next_account_status', next_account_status)
  );

  return query
  select
    p.id,
    p.email,
    coalesce(p.display_name, p.email) as display_name,
    p.account_status,
    p.updated_at
  from public.profiles p
  where p.id = target_profile_id;
end;
$$;

create or replace function public.restore_workspace_safely(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
  workspace_name text;
begin
  if not (
    public.is_superadmin()
    or exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.owner_profile_id = auth.uid()
    )
  ) then
    raise exception 'not_allowed';
  end if;

  update public.workspaces
  set archived_at = null,
      updated_at = now()
  where id = target_workspace_id
  returning name into workspace_name;

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    return jsonb_build_object('restored', false, 'reason', 'workspace_not_found');
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    metadata
  )
  values (
    target_workspace_id,
    auth.uid(),
    'workspaces',
    target_workspace_id,
    'workspace_restored',
    jsonb_build_object('name', workspace_name)
  );

  return jsonb_build_object('restored', true, 'workspace_id', target_workspace_id, 'name', workspace_name);
end;
$$;

create or replace function public.restore_classroom_safely(target_classroom_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  classroom_name text;
  affected_count integer := 0;
begin
  select c.workspace_id, c.name
  into target_workspace_id, classroom_name
  from public.classrooms c
  where c.id = target_classroom_id;

  if target_workspace_id is null then
    return jsonb_build_object('restored', false, 'reason', 'classroom_not_found');
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not_allowed';
  end if;

  update public.classrooms
  set status = 'active',
      updated_at = now()
  where id = target_classroom_id
  returning name into classroom_name;

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    return jsonb_build_object('restored', false, 'reason', 'classroom_not_found');
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    metadata
  )
  values (
    target_workspace_id,
    auth.uid(),
    'classrooms',
    target_classroom_id,
    'classroom_restored',
    jsonb_build_object('name', classroom_name)
  );

  return jsonb_build_object('restored', true, 'classroom_id', target_classroom_id, 'workspace_id', target_workspace_id, 'name', classroom_name);
end;
$$;

create or replace function public.grant_workspace_lifetime_vip(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner_profile_id uuid;
  target_plan_id uuid;
  subscription_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  select w.owner_profile_id
  into target_owner_profile_id
  from public.workspaces w
  where w.id = target_workspace_id;

  if target_owner_profile_id is null then
    return jsonb_build_object('granted', false, 'reason', 'workspace_not_found');
  end if;

  select p.id
  into target_plan_id
  from public.plans p
  where p.code = 'VIP_YEARLY'
  limit 1;

  if target_plan_id is null then
    return jsonb_build_object('granted', false, 'reason', 'vip_plan_not_found');
  end if;

  update public.subscriptions
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cancelled_by_lifetime_override', true)
  where workspace_id = target_workspace_id
    and status in ('trial', 'active', 'suspended');

  insert into public.subscriptions (
    workspace_id,
    profile_id,
    plan_id,
    status,
    starts_at,
    ends_at,
    trial_used,
    source,
    metadata
  )
  values (
    target_workspace_id,
    target_owner_profile_id,
    target_plan_id,
    'active',
    now(),
    null,
    true,
    'superadmin_lifetime_override',
    jsonb_build_object('lifetime', true, 'granted_by', auth.uid())
  )
  returning id into subscription_id;

  insert into public.audit_logs (
    workspace_id,
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    metadata
  )
  values (
    target_workspace_id,
    auth.uid(),
    'subscriptions',
    subscription_id,
    'workspace_lifetime_vip_granted',
    jsonb_build_object('plan_code', 'VIP_YEARLY', 'lifetime', true)
  );

  return jsonb_build_object('granted', true, 'subscription_id', subscription_id, 'workspace_id', target_workspace_id);
end;
$$;

create or replace function public.get_role_capability_audit()
returns table (
  role_key text,
  role_label text,
  capability text,
  implementation_status text,
  route_hint text
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from (
    values
      ('superadmin', 'Superadmin', 'System overview, workspace directory, password reset, user restore/suspend, VIP override, payment review, health, audit', 'ready_with_rpc_0021', '/superadmin/dashboard'),
      ('teacher_owner', 'Workspace Owner', 'Approve teachers, manage members, classrooms, school settings, backup, rollover, archive/delete workspace', 'ready_with_rpc_0012_0020_0021', '/app/settings'),
      ('teacher_member', 'Teacher', 'Attendance, scorebook, savings, behavior, home visit, randomizer, reports within assigned workspace', 'ready', '/app/dashboard'),
      ('viewer', 'Viewer', 'Read-only dashboard and reports for assigned workspace', 'partially_ready', '/app/reports'),
      ('parent', 'Parent Portal', 'View linked student profile, attendance/report snapshots after invitation acceptance', 'portal_ready', '/portal/parent'),
      ('student', 'Student Portal', 'View own profile/report snapshots after account link', 'portal_ready', '/portal/student')
  ) as t(role_key, role_label, capability, implementation_status, route_hint)
  where public.is_superadmin();
$$;

grant execute on function public.set_superadmin_profile_status(uuid, boolean) to authenticated;
grant execute on function public.set_profile_account_status_by_email(text, text) to authenticated;
grant execute on function public.restore_workspace_safely(uuid) to authenticated;
grant execute on function public.restore_classroom_safely(uuid) to authenticated;
grant execute on function public.grant_workspace_lifetime_vip(uuid) to authenticated;
grant execute on function public.get_role_capability_audit() to authenticated;
