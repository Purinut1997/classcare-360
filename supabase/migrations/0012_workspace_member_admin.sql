-- Workspace member management helpers
-- Allows workspace owners to add teachers/viewers by email without exposing profiles broadly.

create or replace function public.can_manage_workspace_members(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner']);
$$;

create or replace function public.get_workspace_members(target_workspace_id uuid)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  joined_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'not_allowed';
  end if;

  return query
  select
    wm.profile_id,
    p.email,
    coalesce(p.display_name, p.email) as display_name,
    wm.role,
    wm.status,
    wm.joined_at,
    wm.created_at
  from public.workspace_memberships wm
  join public.profiles p on p.id = wm.profile_id
  where wm.workspace_id = target_workspace_id
  order by
    case wm.role
      when 'teacher_owner' then 1
      when 'teacher_member' then 2
      when 'viewer' then 3
      when 'parent' then 4
      when 'student' then 5
      else 9
    end,
    wm.created_at asc;
end;
$$;

create or replace function public.add_workspace_member_by_email(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'teacher_member'
)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  joined_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_profile public.profiles%rowtype;
begin
  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'not_allowed';
  end if;

  if target_role not in ('teacher_member', 'viewer') then
    raise exception 'invalid_workspace_member_role';
  end if;

  select *
  into target_profile
  from public.profiles
  where lower(email) = normalized_email
  limit 1;

  if target_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  insert into public.workspace_memberships (
    workspace_id,
    profile_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    target_workspace_id,
    target_profile.id,
    target_role,
    'active',
    auth.uid(),
    now()
  )
  on conflict (workspace_id, profile_id) do update
  set
    role = excluded.role,
    status = 'active',
    invited_by = auth.uid(),
    joined_at = coalesce(public.workspace_memberships.joined_at, now()),
    updated_at = now();

  return query
  select *
  from public.get_workspace_members(target_workspace_id)
  where get_workspace_members.profile_id = target_profile.id;
end;
$$;

create or replace function public.set_workspace_member_status(
  target_workspace_id uuid,
  target_profile_id uuid,
  next_status text
)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  joined_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if not public.can_manage_workspace_members(target_workspace_id) then
    raise exception 'not_allowed';
  end if;

  if next_status not in ('active', 'suspended', 'removed') then
    raise exception 'invalid_workspace_member_status';
  end if;

  select wm.role
  into current_role
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id
    and wm.profile_id = target_profile_id;

  if current_role is null then
    raise exception 'membership_not_found';
  end if;

  if current_role = 'teacher_owner' and not public.is_superadmin() then
    raise exception 'owner_membership_is_protected';
  end if;

  if target_profile_id = auth.uid() and next_status <> 'active' then
    raise exception 'cannot_disable_yourself';
  end if;

  update public.workspace_memberships
  set
    status = next_status,
    updated_at = now()
  where workspace_id = target_workspace_id
    and profile_id = target_profile_id;

  return query
  select *
  from public.get_workspace_members(target_workspace_id)
  where get_workspace_members.profile_id = target_profile_id;
end;
$$;

grant execute on function public.can_manage_workspace_members(uuid) to authenticated;
grant execute on function public.get_workspace_members(uuid) to authenticated;
grant execute on function public.add_workspace_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.set_workspace_member_status(uuid, uuid, text) to authenticated;
