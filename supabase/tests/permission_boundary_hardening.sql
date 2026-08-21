-- Remote-safe regression test for migration 0061. All fixtures are rolled back.
-- Run: npx supabase db query --linked --file supabase/tests/permission_boundary_hardening.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boundary-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boundary-teacher@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boundary-free@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status) values
  ('f1000000-0000-4000-8000-000000000001', 'boundary-owner@example.invalid', 'Boundary Owner', 'active'),
  ('f1000000-0000-4000-8000-000000000002', 'boundary-teacher@example.invalid', 'Boundary Teacher', 'active'),
  ('f1000000-0000-4000-8000-000000000003', 'boundary-free@example.invalid', 'Boundary Free Owner', 'active');

insert into public.workspaces (id, name, owner_profile_id, academic_year) values
  ('f2000000-0000-4000-8000-000000000001', 'Boundary VIP', 'f1000000-0000-4000-8000-000000000001', '2569'),
  ('f2000000-0000-4000-8000-000000000002', 'Boundary Free', 'f1000000-0000-4000-8000-000000000003', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now()),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'teacher_member', 'active', now()),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'teacher_owner', 'active', now());

insert into public.subscriptions (workspace_id, profile_id, plan_id, status, starts_at, ends_at, source)
select 'f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', p.id,
  'active', now(), now() + interval '30 days', 'permission_boundary_test'
from public.plans p where p.code = 'VIP_YEARLY';

insert into public.classrooms (id, workspace_id, name, status) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Boundary assigned', 'active'),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'Boundary unassigned', 'active'),
  ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000002', 'Boundary free', 'active');

insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001');

insert into public.students (id, workspace_id, classroom_id, student_code, first_name, last_name, status) values
  ('f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'BOUND-A', 'Assigned', 'Student', 'active'),
  ('f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', 'BOUND-B', 'Unassigned', 'Student', 'active'),
  ('f4000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003', 'BOUND-F', 'Free', 'Student', 'active');

insert into public.duty_tasks (id, workspace_id, classroom_id, name, created_by) values
  ('f5000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'Assigned duty', 'f1000000-0000-4000-8000-000000000001'),
  ('f5000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', 'Unassigned duty', 'f1000000-0000-4000-8000-000000000001'),
  ('f5000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003', 'Free duty', 'f1000000-0000-4000-8000-000000000003');

insert into public.duty_weeks (id, workspace_id, classroom_id, week_start, status, generated_by) values
  ('f6000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', date '2026-08-17', 'published', 'f1000000-0000-4000-8000-000000000001'),
  ('f6000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', date '2026-08-17', 'published', 'f1000000-0000-4000-8000-000000000001');

insert into public.duty_assignments (
  id, workspace_id, duty_week_id, duty_task_id, duty_date, student_id, slot_number
) values
  ('f7000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', date '2026-08-17', 'f4000000-0000-4000-8000-000000000001', 1),
  ('f7000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', date '2026-08-17', 'f4000000-0000-4000-8000-000000000002', 1);

insert into public.daily_school_briefs (
  id, workspace_id, classroom_id, brief_date, title, summary, created_by
) values
  ('f8000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', date '2026-08-21', 'Assigned brief', 'Assigned', 'f1000000-0000-4000-8000-000000000001'),
  ('f8000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', date '2026-08-21', 'Unassigned brief', 'Unassigned', 'f1000000-0000-4000-8000-000000000001'),
  ('f8000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003', date '2026-08-21', 'Free brief', 'Free', 'f1000000-0000-4000-8000-000000000003');

insert into public.automation_rules (id, workspace_id, name, trigger_type, action_type, created_by) values
  ('f9000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Boundary VIP rule', 'attendance_absence', 'open_care_case', 'f1000000-0000-4000-8000-000000000001'),
  ('f9000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002', 'Boundary Free rule', 'attendance_absence', 'open_care_case', 'f1000000-0000-4000-8000-000000000003');

insert into public.communication_approval_queue (
  id, workspace_id, student_id, recipient_profile_id, recipient_name, title, body,
  reason, source_type, status, created_by
) values (
  'fa000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001',
  'Boundary Owner', 'Boundary queue', 'Boundary body', 'Boundary test', 'manual', 'approved',
  'f1000000-0000-4000-8000-000000000001'
);

-- A mapping may not combine a membership and classroom from different workspaces.
do $$
begin
  begin
    insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id)
    values (
      'f2000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000002',
      'f3000000-0000-4000-8000-000000000003'
    );
    raise exception 'cross-workspace classroom assignment was accepted';
  exception when others then
    if sqlerrm <> 'workspace_member_classroom_scope_mismatch' then raise; end if;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.duty_tasks) <> 1
    or (select count(*) from public.duty_weeks) <> 1
    or (select count(*) from public.duty_assignments) <> 1 then
    raise exception 'teacher duty classroom scope failed';
  end if;

  if (select count(*) from public.daily_school_briefs) <> 1 then
    raise exception 'teacher daily brief classroom scope failed';
  end if;

  if exists (select 1 from public.automation_rules) then
    raise exception 'teacher without automation.manage saw automation rules';
  end if;

  if public.has_workspace_capability('f2000000-0000-4000-8000-000000000001', 'communications.approve') then
    raise exception 'teacher unexpectedly has communications.approve';
  end if;

  update public.duty_tasks set sort_order = 1
  where id = 'f5000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'teacher could not update assigned duty'; end if;

  update public.duty_tasks set sort_order = 2
  where id = 'f5000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'teacher updated unassigned duty'; end if;

  update public.communication_approval_queue set status = 'sending'
  where id = 'fa000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'teacher without approval capability changed queue'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);

do $$
begin
  if exists (select 1 from public.duty_tasks where workspace_id = 'f2000000-0000-4000-8000-000000000002')
    or exists (select 1 from public.daily_school_briefs where workspace_id = 'f2000000-0000-4000-8000-000000000002')
    or exists (select 1 from public.automation_rules where workspace_id = 'f2000000-0000-4000-8000-000000000002') then
    raise exception 'Free workspace bypassed backend module entitlement';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS: duty, daily brief, automation, communication approval, Free entitlement and relationship scope; transaction rolled back' as permission_boundary_hardening;
