-- Superadmin-managed VIP price and package duration with an audit trail.

create or replace function public.set_vip_plan_pricing(
  target_price_thb integer,
  target_duration_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_plan_id uuid;
  previous_price_thb integer;
  previous_duration_days integer;
begin
  if not public.is_superadmin() then raise exception 'not_allowed'; end if;
  if target_price_thb is null or target_price_thb < 0 or target_price_thb > 1000000 then
    raise exception 'vip_price_out_of_range';
  end if;
  if target_duration_days is null or target_duration_days < 1 or target_duration_days > 3650 then
    raise exception 'vip_duration_out_of_range';
  end if;

  select id, price_thb, duration_days
  into target_plan_id, previous_price_thb, previous_duration_days
  from public.plans
  where code = 'VIP_YEARLY'
  for update;

  if target_plan_id is null then raise exception 'vip_plan_not_found'; end if;

  update public.plans
  set price_thb = target_price_thb,
      duration_days = target_duration_days,
      updated_at = now()
  where id = target_plan_id;

  insert into public.audit_logs (
    actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata
  ) values (
    auth.uid(), 'superadmin', 'vip_plan.pricing_updated', 'plans', target_plan_id, 'high',
    jsonb_build_object(
      'previous_price_thb', previous_price_thb,
      'new_price_thb', target_price_thb,
      'previous_duration_days', previous_duration_days,
      'new_duration_days', target_duration_days
    )
  );

  return jsonb_build_object(
    'updated', true,
    'plan_id', target_plan_id,
    'price_thb', target_price_thb,
    'duration_days', target_duration_days
  );
end;
$$;

revoke all on function public.set_vip_plan_pricing(integer, integer) from public;
grant execute on function public.set_vip_plan_pricing(integer, integer) to authenticated;

notify pgrst, 'reload schema';
