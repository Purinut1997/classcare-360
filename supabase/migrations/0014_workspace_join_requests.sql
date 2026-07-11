-- Workspace join request workflow.
-- Teachers can request access only to workspaces that match their profile school_name.
-- Workspace owners approve the request by activating the invited membership.

create or replace function public.list_joinable_school_workspaces()
returns table (
  workspace_id uuid,
  name text,
  school_name text,
  academic_year text,
  classroom_name text,
  owner_display_name text,
  owner_email text,
  membership_status text,
  membership_role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_school text;
begin
  select lower(trim(coalesce(p.metadata->>'school_name', '')))
  into requester_school
  from public.profiles p
  where p.id = auth.uid();

  if requester_school is null or requester_school = '' then
    return;
  end if;

  return query
  select
    w.id as workspace_id,
    w.name,
    w.school_name,
    w.academic_year,
    coalesce(w.settings->>'classroom_name', '') as classroom_name,
    coalesce(owner.display_name, owner.email, '') as owner_display_name,
    coalesce(owner.email, '') as owner_email,
    wm.status as membership_status,
    wm.role as membership_role,
    w.created_at
  from public.workspaces w
  left join public.profiles owner on owner.id = w.owner_profile_id
  left join public.workspace_memberships wm
    on wm.workspace_id = w.id
   and wm.profile_id = auth.uid()
  where w.archived_at is null
    and lower(trim(coalesce(w.school_name, ''))) = requester_school
  order by w.created_at desc;
end;
$$;

create or replace function public.request_workspace_access(target_workspace_id uuid)
returns table (
  workspace_id uuid,
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
  requester_school text;
  target_school text;
  target_archived_at timestamptz;
  current_status text;
  current_role text;
begin
  select lower(trim(coalesce(p.metadata->>'school_name', '')))
  into requester_school
  from public.profiles p
  where p.id = auth.uid();

  if requester_school is null or requester_school = '' then
    raise exception 'profile_school_required';
  end if;

  select lower(trim(coalesce(w.school_name, ''))), w.archived_at
  into target_school, target_archived_at
  from public.workspaces w
  where w.id = target_workspace_id;

  if target_school is null then
    raise exception 'workspace_not_found';
  end if;

  if target_archived_at is not null then
    raise exception 'workspace_archived';
  end if;

  if target_school <> requester_school then
    raise exception 'school_mismatch';
  end if;

  select wm.status, wm.role
  into current_status, current_role
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id
    and wm.profile_id = auth.uid();

  if current_status = 'active' then
    return query
    select
      wm.workspace_id,
      wm.role,
      wm.status,
      wm.joined_at,
      wm.created_at
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid();
    return;
  end if;

  if current_status = 'suspended' then
    raise exception 'membership_suspended';
  end if;

  insert into public.workspace_memberships (
    workspace_id,
    profile_id,
    role,
    status,
    joined_at
  )
  values (
    target_workspace_id,
    auth.uid(),
    'teacher_member',
    'invited',
    null
  )
  on conflict (workspace_id, profile_id) do update
  set
    role = case
      when public.workspace_memberships.role in ('teacher_owner', 'parent', 'student') then public.workspace_memberships.role
      else 'teacher_member'
    end,
    status = 'invited',
    joined_at = null,
    updated_at = now()
  where public.workspace_memberships.status in ('invited', 'removed');

  return query
  select
    wm.workspace_id,
    wm.role,
    wm.status,
    wm.joined_at,
    wm.created_at
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id
    and wm.profile_id = auth.uid();
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
    joined_at = case
      when next_status = 'active' then coalesce(joined_at, now())
      else joined_at
    end,
    updated_at = now()
  where workspace_id = target_workspace_id
    and profile_id = target_profile_id;

  return query
  select *
  from public.get_workspace_members(target_workspace_id)
  where get_workspace_members.profile_id = target_profile_id;
end;
$$;

grant execute on function public.list_joinable_school_workspaces() to authenticated;
grant execute on function public.request_workspace_access(uuid) to authenticated;
grant execute on function public.set_workspace_member_status(uuid, uuid, text) to authenticated;
