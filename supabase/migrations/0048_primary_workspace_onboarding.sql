-- Primary workspace preference and atomic first-workspace onboarding.

create table if not exists public.profile_workspace_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  primary_workspace_id uuid references public.workspaces(id) on delete set null,
  last_active_workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_workspace_preferences_primary_idx
  on public.profile_workspace_preferences (primary_workspace_id);
create index if not exists profile_workspace_preferences_last_active_idx
  on public.profile_workspace_preferences (last_active_workspace_id);

alter table public.profile_workspace_preferences enable row level security;

drop policy if exists "profile_workspace_preferences_select_self_or_superadmin" on public.profile_workspace_preferences;
create policy "profile_workspace_preferences_select_self_or_superadmin"
on public.profile_workspace_preferences for select to authenticated
using (profile_id = auth.uid() or public.is_superadmin());

drop policy if exists "profile_workspace_preferences_update_self_or_superadmin" on public.profile_workspace_preferences;
create policy "profile_workspace_preferences_update_self_or_superadmin"
on public.profile_workspace_preferences for update to authenticated
using (profile_id = auth.uid() or public.is_superadmin())
with check (profile_id = auth.uid() or public.is_superadmin());

drop trigger if exists profile_workspace_preferences_touch_updated_at on public.profile_workspace_preferences;
create trigger profile_workspace_preferences_touch_updated_at
before update on public.profile_workspace_preferences
for each row execute function public.touch_updated_at();

-- Existing users: prefer an active owned workspace, then their oldest active membership.
insert into public.profile_workspace_preferences (profile_id, primary_workspace_id, last_active_workspace_id)
select p.id, chosen.workspace_id, chosen.workspace_id
from public.profiles p
left join lateral (
  select candidates.workspace_id
  from (
    select w.id as workspace_id, 0 as priority, w.created_at
    from public.workspaces w
    where w.owner_profile_id = p.id and w.archived_at is null
    union all
    select wm.workspace_id, 1 as priority, wm.created_at
    from public.workspace_memberships wm
    join public.workspaces w on w.id = wm.workspace_id and w.archived_at is null
    where wm.profile_id = p.id and wm.status = 'active'
  ) candidates
  order by candidates.priority, candidates.created_at
  limit 1
) chosen on true
where chosen.workspace_id is not null
on conflict (profile_id) do nothing;

create or replace function public.set_active_workspace(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_primary_workspace_id uuid;
begin
  if not exists (
    select 1
    from public.workspace_memberships wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
      and wm.status = 'active'
      and w.archived_at is null
  ) and not public.is_superadmin() then
    raise exception 'workspace_access_denied';
  end if;

  select primary_workspace_id into current_primary_workspace_id
  from public.profile_workspace_preferences
  where profile_id = auth.uid();

  insert into public.profile_workspace_preferences (
    profile_id, primary_workspace_id, last_active_workspace_id
  ) values (
    auth.uid(), coalesce(current_primary_workspace_id, target_workspace_id), target_workspace_id
  )
  on conflict (profile_id) do update
  set primary_workspace_id = coalesce(public.profile_workspace_preferences.primary_workspace_id, excluded.primary_workspace_id),
      last_active_workspace_id = excluded.last_active_workspace_id,
      updated_at = now();

  return jsonb_build_object(
    'updated', true,
    'primary_workspace_id', coalesce(current_primary_workspace_id, target_workspace_id),
    'last_active_workspace_id', target_workspace_id
  );
end;
$$;

create or replace function public.create_primary_workspace(
  workspace_name text,
  school_name text,
  academic_year text,
  first_classroom_name text,
  school_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid := auth.uid();
  new_workspace_id uuid;
  new_classroom_id uuid;
  trial_plan_id uuid;
  trial_days integer;
  trial_ends_at timestamptz;
begin
  if actor_profile_id is null then raise exception 'authentication_required'; end if;
  if trim(coalesce(workspace_name, '')) = ''
    or trim(coalesce(school_name, '')) = ''
    or trim(coalesce(academic_year, '')) = ''
    or trim(coalesce(first_classroom_name, '')) = '' then
    raise exception 'workspace_fields_required';
  end if;

  if not public.is_superadmin() and exists (
    select 1 from public.workspaces
    where owner_profile_id = actor_profile_id and archived_at is null
  ) then
    raise exception 'workspace_owner_limit_reached';
  end if;

  insert into public.workspaces (
    name, school_name, school_code, owner_profile_id, academic_year, settings
  ) values (
    trim(workspace_name), trim(school_name), nullif(trim(coalesce(school_code, '')), ''),
    actor_profile_id, trim(academic_year), jsonb_build_object('classroom_name', trim(first_classroom_name))
  ) returning id into new_workspace_id;

  insert into public.workspace_memberships (
    workspace_id, profile_id, role, status, joined_at
  ) values (
    new_workspace_id, actor_profile_id, 'teacher_owner', 'active', now()
  );

  insert into public.classrooms (
    workspace_id, name, academic_year, homeroom_teacher_profile_id, status
  ) values (
    new_workspace_id, trim(first_classroom_name), trim(academic_year), actor_profile_id, 'active'
  ) returning id into new_classroom_id;

  insert into public.profile_workspace_preferences (
    profile_id, primary_workspace_id, last_active_workspace_id
  ) values (
    actor_profile_id, new_workspace_id, new_workspace_id
  )
  on conflict (profile_id) do update
  set primary_workspace_id = coalesce(public.profile_workspace_preferences.primary_workspace_id, excluded.primary_workspace_id),
      last_active_workspace_id = excluded.last_active_workspace_id,
      updated_at = now();

  select p.id, coalesce(p.duration_days, 30)
  into trial_plan_id, trial_days
  from public.plans p
  where p.code = 'TRIAL_30' and p.is_active = true
  limit 1;

  if trial_plan_id is not null then
    trial_ends_at := now() + make_interval(days => trial_days);
    insert into public.subscriptions (
      workspace_id, profile_id, plan_id, status, starts_at, ends_at,
      trial_used, source, metadata
    ) values (
      new_workspace_id, actor_profile_id, trial_plan_id, 'trial', now(), trial_ends_at,
      true, 'atomic_onboarding', jsonb_build_object('trial_days', trial_days)
    );
  end if;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id, action, metadata, risk_level
  ) values (
    new_workspace_id, actor_profile_id, 'workspaces', new_workspace_id,
    'workspace.primary_created',
    jsonb_build_object(
      'classroom_id', new_classroom_id,
      'trial_days', trial_days,
      'trial_ends_at', trial_ends_at
    ),
    'normal'
  );

  return jsonb_build_object(
    'created', true,
    'workspace_id', new_workspace_id,
    'classroom_id', new_classroom_id,
    'trial_days', trial_days,
    'trial_ends_at', trial_ends_at
  );
end;
$$;

revoke all on function public.set_active_workspace(uuid) from public;
revoke all on function public.create_primary_workspace(text, text, text, text, text) from public;
grant execute on function public.set_active_workspace(uuid) to authenticated;
grant execute on function public.create_primary_workspace(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
