-- Remote-safe invitation lifecycle smoke test. All fixtures are rolled back.
-- Run: npx supabase db query --linked --file supabase/tests/workspace_invitation_lifecycle.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-invite-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-invite-teacher@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-invite-outsider@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status) values
  ('f1000000-0000-4000-8000-000000000001', 'rls-invite-owner@example.invalid', 'Invitation Owner', 'active'),
  ('f1000000-0000-4000-8000-000000000002', 'rls-invite-teacher@example.invalid', 'Invitation Teacher', 'active'),
  ('f1000000-0000-4000-8000-000000000003', 'rls-invite-outsider@example.invalid', 'Invitation Outsider', 'active');

insert into public.workspaces (id, name, owner_profile_id, academic_year) values
  ('f2000000-0000-4000-8000-000000000001', 'Invitation VIP Workspace', 'f1000000-0000-4000-8000-000000000001', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now());

insert into public.subscriptions (workspace_id, profile_id, plan_id, status, starts_at, ends_at, source)
select 'f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', p.id,
  'active', now(), now() + interval '30 days', 'invitation_smoke_test'
from public.plans p where p.code = 'VIP_YEARLY';

insert into public.classrooms (id, workspace_id, name, status) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Invited room', 'active'),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'Unassigned room', 'active');

insert into public.students (id, workspace_id, classroom_id, student_code, first_name, last_name, status) values
  ('f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'INV-01', 'Invited', 'Student', 'active'),
  ('f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', 'INV-02', 'Unassigned', 'Student', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);

select public.create_workspace_teacher_invitation(
  'f2000000-0000-4000-8000-000000000001',
  'RLS-INVITE-TEACHER@EXAMPLE.INVALID',
  'teacher_member',
  array['f3000000-0000-4000-8000-000000000001']::uuid[],
  14
);

select set_config(
  'app.rls_invitation_id',
  (select id::text from public.workspace_teacher_invitations
   where workspace_id = 'f2000000-0000-4000-8000-000000000001'
     and invite_email = 'rls-invite-teacher@example.invalid'
     and status = 'invited'),
  true
);

do $$
begin
  if (select count(*) from public.workspace_teacher_invitations
      where workspace_id = 'f2000000-0000-4000-8000-000000000001'
        and invite_email = 'rls-invite-teacher@example.invalid'
        and status = 'invited') <> 1 then
    raise exception 'owner invitation creation failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);

do $$
declare invitation_id uuid;
begin
  if (select count(*) from public.list_my_workspace_teacher_invitations()) <> 0 then
    raise exception 'outsider saw another email invitation';
  end if;

  invitation_id := current_setting('app.rls_invitation_id')::uuid;

  begin
    perform public.accept_workspace_teacher_invitation(invitation_id);
    raise exception 'outsider accepted another email invitation';
  exception when others then
    if sqlerrm <> 'invitation_email_mismatch' then raise; end if;
  end;

  begin
    perform public.create_workspace_teacher_invitation(
      'f2000000-0000-4000-8000-000000000001',
      'blocked@example.invalid', 'viewer', '{}'::uuid[], 14
    );
    raise exception 'outsider created workspace invitation';
  exception when others then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);

do $$
declare invitation_id uuid;
begin
  if (select count(*) from public.list_my_workspace_teacher_invitations()) <> 1 then
    raise exception 'invitee invitation listing failed';
  end if;

  invitation_id := current_setting('app.rls_invitation_id')::uuid;
  perform public.accept_workspace_teacher_invitation(invitation_id);

  if not exists (
    select 1 from public.workspace_memberships
    where workspace_id = 'f2000000-0000-4000-8000-000000000001'
      and profile_id = 'f1000000-0000-4000-8000-000000000002'
      and role = 'teacher_member' and status = 'active'
  ) then raise exception 'invite acceptance membership failed'; end if;

  if not exists (
    select 1 from public.workspace_member_classrooms
    where workspace_id = 'f2000000-0000-4000-8000-000000000001'
      and profile_id = 'f1000000-0000-4000-8000-000000000002'
      and classroom_id = 'f3000000-0000-4000-8000-000000000001'
  ) then raise exception 'invite acceptance classroom assignment failed'; end if;

  if public.workspace_effective_plan_code('f2000000-0000-4000-8000-000000000001') <> 'VIP_YEARLY'
    or not public.can_use_module('f2000000-0000-4000-8000-000000000001', 'scores') then
    raise exception 'invitee did not inherit workspace VIP entitlement';
  end if;

  if (select count(*) from public.students) <> 1 then
    raise exception 'invitee classroom-scoped student visibility failed';
  end if;
end;
$$;

reset role;
update public.workspace_teacher_invitations
set status = 'revoked'
where workspace_id = 'f2000000-0000-4000-8000-000000000001'
  and invite_email = 'rls-invite-teacher@example.invalid';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);

select public.create_workspace_teacher_invitation(
  'f2000000-0000-4000-8000-000000000001',
  'rls-invite-outsider@example.invalid',
  'viewer',
  array['f3000000-0000-4000-8000-000000000001']::uuid[],
  7
);

do $$
declare invitation_id uuid;
begin
  select id into invitation_id from public.workspace_teacher_invitations
  where workspace_id = 'f2000000-0000-4000-8000-000000000001'
    and invite_email = 'rls-invite-outsider@example.invalid'
    and status = 'invited';
  if invitation_id is null then raise exception 'second invitation creation failed'; end if;

  perform public.revoke_workspace_teacher_invitation(invitation_id);
  if not exists (
    select 1 from public.workspace_teacher_invitations
    where id = invitation_id and status = 'revoked'
  ) then raise exception 'owner invitation revoke failed'; end if;
end;
$$;

reset role;
rollback;

select 'PASS: create/list/email-match/accept/classroom-scope/VIP-inheritance/revoke; transaction rolled back' as workspace_invitation_lifecycle;
