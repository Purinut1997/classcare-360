-- Remote-safe smoke test for one teacher working in two schools. All fixtures are rolled back.
-- Run: npx supabase db query --linked --file supabase/tests/cross_school_teacher_scope.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cross-school-teacher@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'school-b-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'school-c-owner@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status) values
  ('91000000-0000-4000-8000-000000000001', 'cross-school-teacher@example.invalid', 'Cross School Teacher', 'active'),
  ('91000000-0000-4000-8000-000000000002', 'school-b-owner@example.invalid', 'School B Owner', 'active'),
  ('91000000-0000-4000-8000-000000000003', 'school-c-owner@example.invalid', 'School C Owner', 'active');

insert into public.workspaces (id, name, school_name, owner_profile_id, academic_year) values
  ('92000000-0000-4000-8000-000000000001', 'Workspace A', 'School A', '91000000-0000-4000-8000-000000000001', '2569'),
  ('92000000-0000-4000-8000-000000000002', 'Workspace B', 'School B', '91000000-0000-4000-8000-000000000002', '2569'),
  ('92000000-0000-4000-8000-000000000003', 'Workspace C', 'School C', '91000000-0000-4000-8000-000000000003', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now()),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'teacher_owner', 'active', now()),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'teacher_member', 'active', now()),
  ('92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003', 'teacher_owner', 'active', now());

insert into public.profile_workspace_preferences (profile_id, primary_workspace_id, last_active_workspace_id) values
  ('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001');

insert into public.subscriptions (workspace_id, profile_id, plan_id, status, starts_at, ends_at, source)
select '92000000-0000-4000-8000-000000000001'::uuid, '91000000-0000-4000-8000-000000000001'::uuid, id, 'active', now(), null::timestamptz, 'cross_school_test'
from public.plans where code = 'FREE_LOGIN'
union all
select '92000000-0000-4000-8000-000000000002'::uuid, '91000000-0000-4000-8000-000000000002'::uuid, id, 'active', now(), now() + interval '30 days', 'cross_school_test'
from public.plans where code = 'VIP_YEARLY';

insert into public.classrooms (id, workspace_id, name, status) values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Room A', 'active'),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'Room B', 'active'),
  ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', 'Room C', 'active');

insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by) values
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002');

insert into public.students (id, workspace_id, classroom_id, student_code, first_name, last_name, status) values
  ('94000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'A-01', 'School', 'A', 'active'),
  ('94000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', 'B-01', 'School', 'B', 'active'),
  ('94000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003', 'C-01', 'School', 'C', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select public.set_active_workspace('92000000-0000-4000-8000-000000000002');

do $$
declare unrelated_denied boolean := false;
begin
  if (select primary_workspace_id from public.profile_workspace_preferences where profile_id = auth.uid())
    <> '92000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'primary workspace changed after switching schools';
  end if;
  if (select last_active_workspace_id from public.profile_workspace_preferences where profile_id = auth.uid())
    <> '92000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'invited workspace was not persisted as active';
  end if;

  if (select count(*) from public.students where workspace_id = '92000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.students where workspace_id = '92000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'cross-school teacher lost an authorized school scope';
  end if;
  if exists (select 1 from public.students where workspace_id = '92000000-0000-4000-8000-000000000003') then
    raise exception 'cross-school teacher saw unrelated school C';
  end if;

  if public.workspace_effective_plan_code('92000000-0000-4000-8000-000000000001') <> 'FREE_LOGIN'
    or public.workspace_effective_plan_code('92000000-0000-4000-8000-000000000002') <> 'VIP_YEARLY' then
    raise exception 'plan did not follow selected workspace';
  end if;
  if not public.has_workspace_capability('92000000-0000-4000-8000-000000000001', 'workspace.manage')
    or public.has_workspace_capability('92000000-0000-4000-8000-000000000002', 'workspace.manage') then
    raise exception 'role capability did not follow workspace membership';
  end if;

  begin
    perform public.set_active_workspace('92000000-0000-4000-8000-000000000003');
  exception when others then
    if sqlerrm = 'workspace_access_denied' then unrelated_denied := true; else raise; end if;
  end;
  if not unrelated_denied then raise exception 'unrelated school switch was accepted'; end if;
end;
$$;

reset role;
rollback;

select 'PASS: owner A, invited teacher B, unrelated C; role/plan/scope/switch; transaction rolled back' as cross_school_teacher_scope;
