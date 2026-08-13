-- Teacher invitations inherit workspace subscription and classroom-scoped core roster RLS.

create table if not exists public.workspace_teacher_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_email text not null,
  role text not null default 'teacher_member' check (role in ('teacher_member', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked', 'expired')),
  assigned_classroom_ids uuid[] not null default '{}',
  permission_overrides jsonb not null default '{}',
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspace_teacher_invitations_pending_unique_idx
  on public.workspace_teacher_invitations (workspace_id, lower(invite_email))
  where status = 'invited';
create index if not exists workspace_teacher_invitations_email_status_idx
  on public.workspace_teacher_invitations (lower(invite_email), status, created_at desc);
create index if not exists workspace_teacher_invitations_workspace_idx
  on public.workspace_teacher_invitations (workspace_id, status, created_at desc);

alter table public.workspace_teacher_invitations enable row level security;

create policy "workspace_teacher_invitations_select_owner_invitee"
on public.workspace_teacher_invitations for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or lower(invite_email) = lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), ''))
);

drop trigger if exists workspace_teacher_invitations_touch_updated_at on public.workspace_teacher_invitations;
create trigger workspace_teacher_invitations_touch_updated_at
before update on public.workspace_teacher_invitations
for each row execute function public.touch_updated_at();

create or replace function public.create_workspace_teacher_invitation(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'teacher_member',
  target_classroom_ids uuid[] default '{}'::uuid[],
  expires_in_days integer default 14
)
returns table (
  id uuid,
  invite_email text,
  role text,
  status text,
  assigned_classroom_ids uuid[],
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  invitation_id uuid;
  requested_classroom_ids uuid[] := coalesce(target_classroom_ids, '{}'::uuid[]);
begin
  if not public.can_manage_workspace_members(target_workspace_id) then raise exception 'not_allowed'; end if;
  if normalized_email = '' then raise exception 'invite_email_required'; end if;
  if target_role not in ('teacher_member', 'viewer') then raise exception 'invalid_workspace_member_role'; end if;
  if expires_in_days is null or expires_in_days < 1 or expires_in_days > 90 then raise exception 'invite_expiry_out_of_range'; end if;
  if exists (
    select 1 from unnest(requested_classroom_ids) assigned_id
    left join public.classrooms c on c.id = assigned_id and c.workspace_id = target_workspace_id and c.status = 'active'
    where c.id is null
  ) then raise exception 'classroom_outside_workspace'; end if;
  if exists (
    select 1 from public.workspace_memberships wm join public.profiles p on p.id = wm.profile_id
    where wm.workspace_id = target_workspace_id and lower(p.email) = normalized_email and wm.status = 'active'
  ) then raise exception 'already_active_member'; end if;

  update public.workspace_teacher_invitations
  set role = target_role,
      assigned_classroom_ids = requested_classroom_ids,
      expires_at = now() + make_interval(days => expires_in_days),
      invited_by = auth.uid(), updated_at = now()
  where workspace_id = target_workspace_id and lower(invite_email) = normalized_email and status = 'invited'
  returning public.workspace_teacher_invitations.id into invitation_id;

  if invitation_id is null then
    insert into public.workspace_teacher_invitations (
      workspace_id, invite_email, role, assigned_classroom_ids, invited_by, expires_at
    ) values (
      target_workspace_id, normalized_email, target_role, requested_classroom_ids,
      auth.uid(), now() + make_interval(days => expires_in_days)
    ) returning public.workspace_teacher_invitations.id into invitation_id;
  end if;

  insert into public.audit_logs (workspace_id, actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata)
  values (
    target_workspace_id, auth.uid(), 'teacher_owner', 'workspace_teacher_invitation.created',
    'workspace_teacher_invitations', invitation_id, 'normal',
    jsonb_build_object('invite_email', normalized_email, 'role', target_role, 'classroom_ids', requested_classroom_ids)
  );

  return query
  select i.id, i.invite_email, i.role, i.status, i.assigned_classroom_ids, i.expires_at, i.created_at
  from public.workspace_teacher_invitations i where i.id = invitation_id;
end;
$$;

create or replace function public.list_my_workspace_teacher_invitations()
returns table (
  invitation_id uuid,
  workspace_id uuid,
  workspace_name text,
  school_name text,
  role text,
  assigned_classroom_ids uuid[],
  expires_at timestamptz,
  created_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select i.id, i.workspace_id, w.name, coalesce(w.school_name, w.name), i.role,
    i.assigned_classroom_ids, i.expires_at, i.created_at
  from public.workspace_teacher_invitations i
  join public.workspaces w on w.id = i.workspace_id and w.archived_at is null
  join public.profiles p on p.id = auth.uid()
  where lower(i.invite_email) = lower(p.email)
    and i.status = 'invited'
    and i.expires_at > now()
  order by i.created_at desc;
$$;

create or replace function public.accept_workspace_teacher_invitation(target_invitation_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  invitation public.workspace_teacher_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select lower(email) into current_email from public.profiles where id = auth.uid();
  select * into invitation from public.workspace_teacher_invitations where id = target_invitation_id for update;

  if invitation.id is null then raise exception 'invitation_not_found'; end if;
  if invitation.status <> 'invited' then raise exception 'invitation_not_pending'; end if;
  if invitation.expires_at <= now() then
    update public.workspace_teacher_invitations set status = 'expired', updated_at = now() where id = invitation.id;
    raise exception 'invitation_expired';
  end if;
  if lower(invitation.invite_email) <> current_email then raise exception 'invitation_email_mismatch'; end if;

  if exists (
    select 1 from unnest(invitation.assigned_classroom_ids) assigned_id
    left join public.classrooms c on c.id = assigned_id and c.workspace_id = invitation.workspace_id and c.status = 'active'
    where c.id is null
  ) then raise exception 'invitation_classroom_invalid'; end if;

  insert into public.workspace_memberships (
    workspace_id, profile_id, role, status, permissions, invited_by, joined_at
  ) values (
    invitation.workspace_id, auth.uid(), invitation.role, 'active', invitation.permission_overrides,
    invitation.invited_by, now()
  ) on conflict (workspace_id, profile_id) do update
  set role = case when public.workspace_memberships.role = 'teacher_owner' then 'teacher_owner' else excluded.role end,
      status = 'active', permissions = excluded.permissions, invited_by = excluded.invited_by,
      joined_at = coalesce(public.workspace_memberships.joined_at, now()), updated_at = now();

  delete from public.workspace_member_classrooms
  where workspace_id = invitation.workspace_id and profile_id = auth.uid();
  insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by)
  select invitation.workspace_id, auth.uid(), classroom_id, invitation.invited_by
  from unnest(invitation.assigned_classroom_ids) classroom_id;

  update public.workspace_teacher_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  where id = invitation.id;

  insert into public.audit_logs (workspace_id, actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata)
  values (
    invitation.workspace_id, auth.uid(), invitation.role, 'workspace_teacher_invitation.accepted',
    'workspace_teacher_invitations', invitation.id, 'normal',
    jsonb_build_object('subscription_inherited', true, 'classroom_ids', invitation.assigned_classroom_ids)
  );

  return jsonb_build_object(
    'accepted', true, 'workspace_id', invitation.workspace_id,
    'role', invitation.role, 'subscription_inherited', true
  );
end;
$$;

create or replace function public.revoke_workspace_teacher_invitation(target_invitation_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id from public.workspace_teacher_invitations where id = target_invitation_id;
  if target_workspace_id is null then raise exception 'invitation_not_found'; end if;
  if not public.can_manage_workspace_members(target_workspace_id) then raise exception 'not_allowed'; end if;
  update public.workspace_teacher_invitations set status = 'revoked', updated_at = now()
  where id = target_invitation_id and status = 'invited';
  return jsonb_build_object('revoked', found, 'invitation_id', target_invitation_id);
end;
$$;

-- A teacher can access a student only when the student's classroom is assigned.
create or replace function public.can_access_student(target_workspace_id uuid, target_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
    or exists (
      select 1 from public.students s
      where s.id = target_student_id and s.workspace_id = target_workspace_id
        and s.classroom_id is not null
        and public.can_access_classroom(target_workspace_id, s.classroom_id)
    );
$$;

drop policy if exists "classrooms_select_workspace_or_superadmin" on public.classrooms;
create policy "classrooms_select_scoped_member_or_superadmin"
on public.classrooms for select to authenticated
using (public.can_access_classroom(workspace_id, id));

drop policy if exists "classrooms_insert_teacher_or_superadmin" on public.classrooms;
create policy "classrooms_insert_owner_or_superadmin"
on public.classrooms for insert to authenticated
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']));

drop policy if exists "students_select_workspace_or_linked_guardian" on public.students;
create policy "students_select_scoped_teacher_or_linked_portal"
on public.students for select to authenticated
using (
  public.can_access_student(workspace_id, id)
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = students.id and sg.profile_id = auth.uid()
      and sg.workspace_id = students.workspace_id and sg.consent_status = 'granted'
  )
  or exists (
    select 1 from public.student_profile_links spl
    where spl.student_id = students.id and spl.profile_id = auth.uid()
      and spl.workspace_id = students.workspace_id and spl.status = 'active'
  )
);

drop policy if exists "students_insert_teacher_or_superadmin" on public.students;
create policy "students_insert_scoped_teacher_or_superadmin"
on public.students for insert to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or (classroom_id is not null and public.can_access_classroom(workspace_id, classroom_id))
);

drop policy if exists "students_update_teacher_or_superadmin" on public.students;
create policy "students_update_scoped_teacher_or_superadmin"
on public.students for update to authenticated
using (public.can_access_student(workspace_id, id))
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or (classroom_id is not null and public.can_access_classroom(workspace_id, classroom_id))
);

revoke all on function public.create_workspace_teacher_invitation(uuid, text, text, uuid[], integer) from public;
revoke all on function public.list_my_workspace_teacher_invitations() from public;
revoke all on function public.accept_workspace_teacher_invitation(uuid) from public;
revoke all on function public.revoke_workspace_teacher_invitation(uuid) from public;
revoke all on function public.can_access_student(uuid, uuid) from public;
grant execute on function public.create_workspace_teacher_invitation(uuid, text, text, uuid[], integer) to authenticated;
grant execute on function public.list_my_workspace_teacher_invitations() to authenticated;
grant execute on function public.accept_workspace_teacher_invitation(uuid) to authenticated;
grant execute on function public.revoke_workspace_teacher_invitation(uuid) to authenticated;
grant execute on function public.can_access_student(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
