-- Workspace discovery for teachers from the same school.
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
declare requester_school text;
begin
  select lower(trim(coalesce(p.metadata->>'school_name', '')))
  into requester_school
  from public.profiles p
  where p.id = auth.uid();

  if requester_school is null or requester_school = '' then return; end if;

  return query
  select w.id, w.name, w.school_name, w.academic_year,
    coalesce(w.settings->>'classroom_name', ''),
    coalesce(owner.display_name, owner.email, ''),
    coalesce(owner.email, ''), wm.status, wm.role, w.created_at
  from public.workspaces w
  left join public.profiles owner on owner.id = w.owner_profile_id
  left join public.workspace_memberships wm
    on wm.workspace_id = w.id and wm.profile_id = auth.uid()
  where w.archived_at is null
    and lower(trim(coalesce(w.school_name, ''))) = requester_school
  order by w.created_at desc;
end;
$$;

create or replace function public.request_workspace_access(target_workspace_id uuid)
returns table (workspace_id uuid, role text, status text, joined_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare requester_school text; target_school text; target_archived_at timestamptz;
begin
  select lower(trim(coalesce(p.metadata->>'school_name', ''))) into requester_school
  from public.profiles p where p.id = auth.uid();
  if requester_school is null or requester_school = '' then raise exception 'profile_school_required'; end if;

  select lower(trim(coalesce(w.school_name, ''))), w.archived_at
  into target_school, target_archived_at from public.workspaces w where w.id = target_workspace_id;
  if target_school is null then raise exception 'workspace_not_found'; end if;
  if target_archived_at is not null then raise exception 'workspace_archived'; end if;
  if target_school <> requester_school then raise exception 'school_mismatch'; end if;

  if exists (
    select 1 from public.workspace_memberships
    where workspace_id = target_workspace_id and profile_id = auth.uid() and status = 'suspended'
  ) then raise exception 'membership_suspended'; end if;

  insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at)
  values (target_workspace_id, auth.uid(), 'teacher_member', 'invited', null)
  on conflict (workspace_id, profile_id) do update
  set role = case when public.workspace_memberships.role in ('teacher_owner','parent','student')
      then public.workspace_memberships.role else 'teacher_member' end,
    status = case when public.workspace_memberships.status = 'active'
      then 'active' else 'invited' end,
    updated_at = now();

  return query select wm.workspace_id, wm.role, wm.status, wm.joined_at, wm.created_at
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id and wm.profile_id = auth.uid();
end;
$$;

grant execute on function public.list_joinable_school_workspaces() to authenticated;
grant execute on function public.request_workspace_access(uuid) to authenticated;
