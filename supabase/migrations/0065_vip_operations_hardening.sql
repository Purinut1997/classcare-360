-- 0065_vip_operations_hardening.sql
-- Adds toggle_vip_code_status and grant_workspace_vip RPCs for complete VIP lifecycle management.

create or replace function public.toggle_vip_code_status(
  target_code_id uuid,
  target_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_code public.vip_redemption_codes%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  select * into target_code
  from public.vip_redemption_codes
  where id = target_code_id
  for update;

  if target_code.id is null then
    raise exception 'code_not_found';
  end if;

  update public.vip_redemption_codes
  set is_active = target_is_active,
      updated_at = now()
  where id = target_code_id;

  insert into public.audit_logs (
    actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata
  ) values (
    auth.uid(), 'superadmin', 'vip_code.status_toggled', 'vip_redemption_codes', target_code_id, 'medium',
    jsonb_build_object('previous_state', target_code.is_active, 'new_state', target_is_active, 'code_prefix', target_code.code_prefix)
  );

  return jsonb_build_object('updated', true, 'code_id', target_code_id, 'is_active', target_is_active);
end;
$$;

create or replace function public.grant_workspace_vip(
  target_workspace_id uuid,
  days_to_add integer,
  grant_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_plan_id uuid;
  target_owner_profile_id uuid;
  current_subscription public.subscriptions%rowtype;
  new_subscription_id uuid;
  previous_ends_at timestamptz;
  new_ends_at timestamptz;
  clean_reason text := nullif(trim(coalesce(grant_reason, '')), '');
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if days_to_add is null or days_to_add < 1 or days_to_add > 36500 then
    raise exception 'days_to_add_out_of_range';
  end if;

  select owner_profile_id into target_owner_profile_id
  from public.workspaces
  where id = target_workspace_id and archived_at is null;

  if target_owner_profile_id is null then
    raise exception 'workspace_not_found';
  end if;

  select id into target_plan_id
  from public.plans
  where code = 'VIP_YEARLY' and is_active = true
  limit 1;

  if target_plan_id is null then
    raise exception 'vip_plan_not_found';
  end if;

  select * into current_subscription
  from public.subscriptions
  where workspace_id = target_workspace_id and status in ('trial', 'active')
  order by created_at desc
  limit 1
  for update;

  previous_ends_at := current_subscription.ends_at;
  new_ends_at := greatest(now(), coalesce(current_subscription.ends_at, now())) + make_interval(days => days_to_add);

  update public.subscriptions
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('replaced_by_superadmin_grant', true)
  where workspace_id = target_workspace_id and status in ('trial', 'active');

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
  ) values (
    target_workspace_id,
    target_owner_profile_id,
    target_plan_id,
    'active',
    now(),
    new_ends_at,
    true,
    'superadmin_direct_grant',
    jsonb_build_object(
      'granted_by', auth.uid(),
      'reason', clean_reason,
      'days_added', days_to_add
    )
  ) returning id into new_subscription_id;

  insert into public.subscription_entitlement_events (
    workspace_id,
    subscription_id,
    actor_profile_id,
    event_type,
    delta_days,
    previous_ends_at,
    new_ends_at,
    source_reference,
    metadata
  ) values (
    target_workspace_id,
    new_subscription_id,
    auth.uid(),
    'manual_override',
    days_to_add,
    previous_ends_at,
    new_ends_at,
    'superadmin_grant',
    jsonb_build_object('reason', clean_reason)
  );

  insert into public.audit_logs (
    workspace_id,
    actor_profile_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    risk_level,
    metadata
  ) values (
    target_workspace_id,
    auth.uid(),
    'superadmin',
    'workspace.vip_granted',
    'subscriptions',
    new_subscription_id,
    'high',
    jsonb_build_object(
      'days_added', days_to_add,
      'new_ends_at', new_ends_at,
      'reason', clean_reason
    )
  );

  return jsonb_build_object(
    'granted', true,
    'workspace_id', target_workspace_id,
    'days_added', days_to_add,
    'new_ends_at', new_ends_at,
    'subscription_id', new_subscription_id
  );
end;
$$;

revoke all on function public.toggle_vip_code_status(uuid, boolean) from public;
grant execute on function public.toggle_vip_code_status(uuid, boolean) to authenticated;

revoke all on function public.grant_workspace_vip(uuid, integer, text) from public;
grant execute on function public.grant_workspace_vip(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
