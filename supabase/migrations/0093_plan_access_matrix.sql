-- ClassCare 360 - Dynamic Plan Access Matrix (Free / Trial / Temporary VIP)
-- Allows SuperAdmin to configure which modules & AI features each non-lifetime tier can access.

create table if not exists public.plan_access_policies (
  tier_key text primary key check (tier_key in ('free', 'trial', 'temp_vip')),
  allowed_views text[] not null default '{}',
  allow_ai_gemini boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.plan_access_policies enable row level security;

drop policy if exists "plan_access_policies_read" on public.plan_access_policies;
create policy "plan_access_policies_read"
on public.plan_access_policies
for select
to authenticated
using (true);

drop policy if exists "plan_access_policies_superadmin_write" on public.plan_access_policies;
create policy "plan_access_policies_superadmin_write"
on public.plan_access_policies
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

-- Seed defaults matching standard ClassCare 360 tier entitlements
insert into public.plan_access_policies (tier_key, allowed_views, allow_ai_gemini)
values
  (
    'free',
    array['students', 'teacher-work', 'student-health', 'schedule', 'school-calendar', 'data-safety', 'academic-year'],
    false
  ),
  (
    'trial',
    array[
      'students', 'teacher-work', 'savings', 'student-health', 'classroom-operations',
      'schedule', 'scores', 'omr-scanner', 'academic-hub', 'reports', 'daily-brief',
      'behavior', 'desirable-characteristics', 'notifications',
      'randomizer', 'school-calendar', 'import-export', 'data-safety', 'academic-year'
    ],
    false
  ),
  (
    'temp_vip',
    array[
      'students', 'teacher-work', 'savings', 'student-health', 'classroom-operations',
      'schedule', 'scores', 'omr-scanner', 'academic-hub', 'reports', 'daily-brief',
      'behavior', 'desirable-characteristics', 'notifications',
      'randomizer', 'school-calendar', 'import-export', 'data-safety', 'academic-year'
    ],
    true
  )
on conflict (tier_key) do nothing;

-- SuperAdmin RPC to save a tier's access policy with audit trail
create or replace function public.superadmin_save_plan_access_policy(
  p_tier_key text,
  p_allowed_views text[],
  p_allow_ai_gemini boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.plan_access_policies;
begin
  if not public.is_superadmin() then
    raise exception 'forbidden: superadmin only' using errcode = '42501';
  end if;

  if p_tier_key not in ('free', 'trial', 'temp_vip') then
    raise exception 'invalid tier_key: %', p_tier_key using errcode = '22023';
  end if;

  insert into public.plan_access_policies (tier_key, allowed_views, allow_ai_gemini, updated_by, updated_at)
  values (
    p_tier_key,
    coalesce(p_allowed_views, '{}'::text[]),
    coalesce(p_allow_ai_gemini, false),
    auth.uid(),
    now()
  )
  on conflict (tier_key) do update
  set
    allowed_views = excluded.allowed_views,
    allow_ai_gemini = excluded.allow_ai_gemini,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_row;

  insert into public.audit_logs (
    actor_profile_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    risk_level,
    metadata
  ) values (
    auth.uid(),
    'superadmin',
    'plan_access_policy.updated',
    'plan_access_policies',
    null,
    'high',
    jsonb_build_object(
      'tier_key', v_row.tier_key,
      'allowed_count', coalesce(array_length(v_row.allowed_views, 1), 0),
      'allow_ai_gemini', v_row.allow_ai_gemini
    )
  );

  return jsonb_build_object(
    'tier_key', v_row.tier_key,
    'allowed_views', v_row.allowed_views,
    'allow_ai_gemini', v_row.allow_ai_gemini,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.superadmin_save_plan_access_policy(text, text[], boolean) from public;
grant execute on function public.superadmin_save_plan_access_policy(text, text[], boolean) to authenticated;

-- Enable Supabase Realtime so connected clients receive policy updates immediately
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'plan_access_policies'
  ) then
    alter publication supabase_realtime add table public.plan_access_policies;
  end if;
exception
  when undefined_object then
    null;
end $$;
