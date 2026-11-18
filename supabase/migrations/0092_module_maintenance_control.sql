-- 0092_module_maintenance_control.sql
-- Per-Module Maintenance Mode:
-- Allows SuperAdmin to pause individual modules (e.g. savings, reports, omr-scanner)
-- with a custom message and optional scheduled reopen time while all other modules keep working.
-- SuperAdmins can always bypass module maintenance to test fixes safely.

create table if not exists public.module_maintenance (
  module_key text primary key,
  is_under_maintenance boolean not null default false,
  message text not null default '',
  ends_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.module_maintenance enable row level security;

drop policy if exists "Anyone can read module maintenance status" on public.module_maintenance;
create policy "Anyone can read module maintenance status"
  on public.module_maintenance
  for select
  to authenticated, anon
  using (true);

drop policy if exists "Superadmin can manage module maintenance" on public.module_maintenance;
create policy "Superadmin can manage module maintenance"
  on public.module_maintenance
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Public lightweight RPC returning only active (non-expired) maintenance entries
create or replace function public.get_module_maintenance_map()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_object_agg(
      m.module_key,
      jsonb_build_object(
        'moduleKey', m.module_key,
        'isUnderMaintenance', true,
        'message', m.message,
        'endsAt', m.ends_at,
        'updatedAt', m.updated_at
      )
    ),
    '{}'::jsonb
  )
  into result
  from public.module_maintenance m
  where m.is_under_maintenance = true
    and (m.ends_at is null or m.ends_at > now());

  return result;
end;
$$;

-- Superadmin RPC: set maintenance state for one module
create or replace function public.superadmin_set_module_maintenance(
  p_module_key text,
  p_is_under_maintenance boolean,
  p_message text default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_key text := lower(trim(coalesce(p_module_key, '')));
  cleaned_msg text := trim(coalesce(p_message, ''));
  rec public.module_maintenance%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if cleaned_key = '' or cleaned_key in ('overview', 'superadmin-dashboard') then
    raise exception 'invalid_module_key';
  end if;

  insert into public.module_maintenance (
    module_key,
    is_under_maintenance,
    message,
    ends_at,
    updated_by,
    updated_at
  ) values (
    cleaned_key,
    coalesce(p_is_under_maintenance, false),
    cleaned_msg,
    case when coalesce(p_is_under_maintenance, false) then p_ends_at else null end,
    auth.uid(),
    now()
  )
  on conflict (module_key) do update
  set
    is_under_maintenance = excluded.is_under_maintenance,
    message = excluded.message,
    ends_at = excluded.ends_at,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into rec;

  insert into public.audit_logs (
    actor_profile_id, entity_table, action, risk_level, metadata
  ) values (
    auth.uid(),
    'module_maintenance',
    case when rec.is_under_maintenance then 'superadmin_module_maintenance_enabled' else 'superadmin_module_maintenance_disabled' end,
    case when rec.is_under_maintenance then 'high' else 'normal' end,
    jsonb_build_object(
      'module_key', rec.module_key,
      'is_under_maintenance', rec.is_under_maintenance,
      'message', rec.message,
      'ends_at', rec.ends_at
    )
  );

  return jsonb_build_object(
    'moduleKey', rec.module_key,
    'isUnderMaintenance', rec.is_under_maintenance,
    'message', rec.message,
    'endsAt', rec.ends_at,
    'updatedAt', rec.updated_at
  );
end;
$$;

-- Superadmin RPC: reopen all modules at once
create or replace function public.superadmin_clear_all_module_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  update public.module_maintenance
  set is_under_maintenance = false, ends_at = null, updated_by = auth.uid(), updated_at = now()
  where is_under_maintenance = true;

  get diagnostics affected = row_count;

  insert into public.audit_logs (
    actor_profile_id, entity_table, action, risk_level, metadata
  ) values (
    auth.uid(), 'module_maintenance', 'superadmin_all_modules_reopened', 'normal',
    jsonb_build_object('reopened_count', affected)
  );

  return jsonb_build_object('reopened_count', affected);
end;
$$;

revoke all on function public.get_module_maintenance_map() from public;
grant execute on function public.get_module_maintenance_map() to authenticated, anon;

revoke all on function public.superadmin_set_module_maintenance(text, boolean, text, timestamptz) from public;
grant execute on function public.superadmin_set_module_maintenance(text, boolean, text, timestamptz) to authenticated;

revoke all on function public.superadmin_clear_all_module_maintenance() from public;
grant execute on function public.superadmin_clear_all_module_maintenance() to authenticated;

notify pgrst, 'reload schema';
