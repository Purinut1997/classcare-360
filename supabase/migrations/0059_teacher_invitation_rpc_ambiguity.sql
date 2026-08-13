-- Qualify invitation columns that collide with RETURNS TABLE output names.

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

  update public.workspace_teacher_invitations as invitation
  set role = target_role,
      assigned_classroom_ids = requested_classroom_ids,
      expires_at = now() + make_interval(days => expires_in_days),
      invited_by = auth.uid(), updated_at = now()
  where invitation.workspace_id = target_workspace_id
    and lower(invitation.invite_email) = normalized_email
    and invitation.status = 'invited'
  returning invitation.id into invitation_id;

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
  select invitation.id, invitation.invite_email, invitation.role, invitation.status,
    invitation.assigned_classroom_ids, invitation.expires_at, invitation.created_at
  from public.workspace_teacher_invitations as invitation
  where invitation.id = invitation_id;
end;
$$;

revoke all on function public.create_workspace_teacher_invitation(uuid, text, text, uuid[], integer) from public;
grant execute on function public.create_workspace_teacher_invitation(uuid, text, text, uuid[], integer) to authenticated;

notify pgrst, 'reload schema';
