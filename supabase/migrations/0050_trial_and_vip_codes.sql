-- Configurable onboarding trial and auditable VIP redemption codes.

create extension if not exists pgcrypto;

create table if not exists public.vip_redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_prefix text not null,
  label text not null,
  duration_days integer not null check (duration_days between 1 and 3650),
  max_redemptions integer not null default 1 check (max_redemptions between 1 and 100000),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vip_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.vip_redemption_codes(id),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  redeemed_by uuid not null references public.profiles(id),
  duration_days integer not null check (duration_days > 0),
  previous_ends_at timestamptz,
  new_ends_at timestamptz not null,
  subscription_id uuid not null references public.subscriptions(id),
  created_at timestamptz not null default now(),
  unique (code_id, workspace_id)
);

create table if not exists public.subscription_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('trial_started', 'vip_code_redeemed', 'payment_approved', 'manual_override')),
  delta_days integer,
  previous_ends_at timestamptz,
  new_ends_at timestamptz,
  source_reference text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists vip_redemption_codes_active_idx
  on public.vip_redemption_codes (is_active, expires_at);
create index if not exists vip_code_redemptions_workspace_idx
  on public.vip_code_redemptions (workspace_id, created_at desc);
create index if not exists subscription_entitlement_events_workspace_idx
  on public.subscription_entitlement_events (workspace_id, created_at desc);

alter table public.vip_redemption_codes enable row level security;
alter table public.vip_code_redemptions enable row level security;
alter table public.subscription_entitlement_events enable row level security;

create policy "vip_redemption_codes_superadmin_select"
on public.vip_redemption_codes for select to authenticated
using (public.is_superadmin());

create policy "vip_code_redemptions_workspace_select"
on public.vip_code_redemptions for select to authenticated
using (public.is_superadmin() or public.is_workspace_member(workspace_id));

create policy "subscription_entitlement_events_workspace_select"
on public.subscription_entitlement_events for select to authenticated
using (public.is_superadmin() or public.is_workspace_member(workspace_id));

drop trigger if exists vip_redemption_codes_touch_updated_at on public.vip_redemption_codes;
create trigger vip_redemption_codes_touch_updated_at
before update on public.vip_redemption_codes
for each row execute function public.touch_updated_at();

create or replace function public.set_trial_duration_days(target_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_plan_id uuid;
begin
  if not public.is_superadmin() then raise exception 'not_allowed'; end if;
  if target_days is null or target_days < 1 or target_days > 365 then
    raise exception 'trial_days_out_of_range';
  end if;

  update public.plans
  set duration_days = target_days, updated_at = now()
  where code = 'TRIAL_30'
  returning id into target_plan_id;

  if target_plan_id is null then raise exception 'trial_plan_not_found'; end if;

  insert into public.audit_logs (actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata)
  values (auth.uid(), 'superadmin', 'trial_duration.updated', 'plans', target_plan_id, 'high', jsonb_build_object('duration_days', target_days));

  return jsonb_build_object('updated', true, 'duration_days', target_days);
end;
$$;

create or replace function public.create_vip_redemption_code(
  code_label text,
  code_duration_days integer,
  code_max_redemptions integer default 1,
  code_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_code text;
  new_code_id uuid;
begin
  if not public.is_superadmin() then raise exception 'not_allowed'; end if;
  if trim(coalesce(code_label, '')) = '' then raise exception 'code_label_required'; end if;
  if code_duration_days is null or code_duration_days < 1 or code_duration_days > 3650 then
    raise exception 'code_duration_out_of_range';
  end if;
  if code_max_redemptions is null or code_max_redemptions < 1 or code_max_redemptions > 100000 then
    raise exception 'code_redemptions_out_of_range';
  end if;
  if code_expires_at is not null and code_expires_at <= now() then raise exception 'code_expiry_in_past'; end if;

  raw_code := 'CC360-' || upper(encode(gen_random_bytes(6), 'hex'));

  insert into public.vip_redemption_codes (
    code_hash, code_prefix, label, duration_days, max_redemptions, expires_at, created_by
  ) values (
    encode(digest(raw_code, 'sha256'), 'hex'), left(raw_code, 11), trim(code_label),
    code_duration_days, code_max_redemptions, code_expires_at, auth.uid()
  ) returning id into new_code_id;

  insert into public.audit_logs (actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata)
  values (
    auth.uid(), 'superadmin', 'vip_code.created', 'vip_redemption_codes', new_code_id, 'high',
    jsonb_build_object('label', trim(code_label), 'duration_days', code_duration_days, 'max_redemptions', code_max_redemptions)
  );

  return jsonb_build_object('created', true, 'code_id', new_code_id, 'code', raw_code);
end;
$$;

create or replace function public.redeem_vip_code(target_workspace_id uuid, redemption_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.vip_redemption_codes%rowtype;
  current_subscription public.subscriptions%rowtype;
  target_plan_id uuid;
  target_owner_profile_id uuid;
  new_subscription_id uuid;
  previous_ends_at timestamptz;
  new_ends_at timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.owns_workspace(target_workspace_id) and not public.is_superadmin() then
    raise exception 'workspace_owner_required';
  end if;

  select * into code_row
  from public.vip_redemption_codes
  where code_hash = encode(digest(upper(trim(coalesce(redemption_code, ''))), 'sha256'), 'hex')
  for update;

  if code_row.id is null then raise exception 'vip_code_invalid'; end if;
  if not code_row.is_active then raise exception 'vip_code_inactive'; end if;
  if code_row.expires_at is not null and code_row.expires_at <= now() then raise exception 'vip_code_expired'; end if;
  if code_row.redemption_count >= code_row.max_redemptions then raise exception 'vip_code_fully_redeemed'; end if;
  if exists (
    select 1 from public.vip_code_redemptions r
    where r.code_id = code_row.id and r.workspace_id = target_workspace_id
  ) then raise exception 'vip_code_already_redeemed'; end if;

  select id into target_plan_id from public.plans where code = 'VIP_YEARLY' and is_active = true limit 1;
  select owner_profile_id into target_owner_profile_id from public.workspaces where id = target_workspace_id and archived_at is null;
  if target_plan_id is null then raise exception 'vip_plan_not_found'; end if;
  if target_owner_profile_id is null then raise exception 'workspace_not_found'; end if;

  select * into current_subscription
  from public.subscriptions
  where workspace_id = target_workspace_id and status in ('trial', 'active')
  order by created_at desc limit 1
  for update;

  if current_subscription.id is not null
     and current_subscription.status = 'active'
     and current_subscription.ends_at is null then
    raise exception 'workspace_has_lifetime_vip';
  end if;

  previous_ends_at := current_subscription.ends_at;
  new_ends_at := greatest(now(), coalesce(current_subscription.ends_at, now())) + make_interval(days => code_row.duration_days);

  update public.subscriptions
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('replaced_by_vip_code_id', code_row.id)
  where workspace_id = target_workspace_id and status in ('trial', 'active');

  insert into public.subscriptions (
    workspace_id, profile_id, plan_id, status, starts_at, ends_at, trial_used, source, metadata
  ) values (
    target_workspace_id, target_owner_profile_id, target_plan_id, 'active', now(), new_ends_at, true,
    'vip_redemption_code', jsonb_build_object('vip_code_id', code_row.id, 'redeemed_by', auth.uid())
  ) returning id into new_subscription_id;

  insert into public.vip_code_redemptions (
    code_id, workspace_id, redeemed_by, duration_days, previous_ends_at, new_ends_at, subscription_id
  ) values (
    code_row.id, target_workspace_id, auth.uid(), code_row.duration_days, previous_ends_at, new_ends_at, new_subscription_id
  );

  update public.vip_redemption_codes
  set redemption_count = redemption_count + 1,
      is_active = case when redemption_count + 1 >= max_redemptions then false else is_active end,
      updated_at = now()
  where id = code_row.id;

  insert into public.subscription_entitlement_events (
    workspace_id, subscription_id, actor_profile_id, event_type, delta_days,
    previous_ends_at, new_ends_at, source_reference, metadata
  ) values (
    target_workspace_id, new_subscription_id, auth.uid(), 'vip_code_redeemed', code_row.duration_days,
    previous_ends_at, new_ends_at, code_row.id::text, jsonb_build_object('code_label', code_row.label)
  );

  insert into public.audit_logs (
    workspace_id, actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'teacher_owner', 'vip_code.redeemed', 'subscriptions', new_subscription_id, 'high',
    jsonb_build_object('code_id', code_row.id, 'duration_days', code_row.duration_days, 'new_ends_at', new_ends_at)
  );

  return jsonb_build_object(
    'redeemed', true, 'duration_days', code_row.duration_days,
    'subscription_id', new_subscription_id, 'ends_at', new_ends_at
  );
end;
$$;

revoke all on function public.set_trial_duration_days(integer) from public;
revoke all on function public.create_vip_redemption_code(text, integer, integer, timestamptz) from public;
revoke all on function public.redeem_vip_code(uuid, text) from public;
grant execute on function public.set_trial_duration_days(integer) to authenticated;
grant execute on function public.create_vip_redemption_code(text, integer, integer, timestamptz) to authenticated;
grant execute on function public.redeem_vip_code(uuid, text) to authenticated;
