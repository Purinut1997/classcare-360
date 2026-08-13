-- Remote-safe RLS smoke test for sensitive teacher activity. All fixtures are rolled back.
-- Run: npx supabase db query --linked --file supabase/tests/rls_sensitive_activity_roles.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-activity-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-activity-member@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-activity-other@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status) values
  ('e1000000-0000-4000-8000-000000000001', 'rls-activity-owner@example.invalid', 'Activity Owner', 'active'),
  ('e1000000-0000-4000-8000-000000000002', 'rls-activity-member@example.invalid', 'Activity Member', 'active'),
  ('e1000000-0000-4000-8000-000000000003', 'rls-activity-other@example.invalid', 'Activity Other Owner', 'active');

insert into public.workspaces (id, name, owner_profile_id, academic_year) values
  ('e2000000-0000-4000-8000-000000000001', 'Activity VIP Workspace', 'e1000000-0000-4000-8000-000000000001', '2569'),
  ('e2000000-0000-4000-8000-000000000002', 'Activity Free Workspace', 'e1000000-0000-4000-8000-000000000003', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now()),
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'teacher_member', 'active', now()),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', 'teacher_owner', 'active', now());

insert into public.subscriptions (workspace_id, profile_id, plan_id, status, starts_at, ends_at, source)
select 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', p.id,
  'active', now(), now() + interval '30 days', 'rls_smoke_test'
from public.plans p where p.code = 'VIP_YEARLY';

insert into public.classrooms (id, workspace_id, name, status) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Activity assigned room', 'active'),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'Activity unassigned room', 'archived'),
  ('e3000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'Activity free room', 'active');

insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');

insert into public.students (id, workspace_id, classroom_id, student_code, first_name, last_name, status) values
  ('e4000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'ACT-A-01', 'Assigned', 'Activity', 'active'),
  ('e4000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002', 'ACT-A-02', 'Unassigned', 'Activity', 'active'),
  ('e4000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000003', 'ACT-B-01', 'Free', 'Activity', 'active');

insert into public.score_assessments (id, workspace_id, classroom_id, title, subject_name, created_by) values
  ('e5000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'Assigned score', 'คณิตศาสตร์', 'e1000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002', 'Unassigned score', 'คณิตศาสตร์', 'e1000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000003', 'Free score', 'คณิตศาสตร์', 'e1000000-0000-4000-8000-000000000003');

insert into public.score_entries (id, workspace_id, assessment_id, student_id, score, graded_by) values
  ('e6000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 80, 'e1000000-0000-4000-8000-000000000001'),
  ('e6000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000002', 70, 'e1000000-0000-4000-8000-000000000001'),
  ('e6000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e5000000-0000-4000-8000-000000000003', 'e4000000-0000-4000-8000-000000000003', 60, 'e1000000-0000-4000-8000-000000000003');

insert into public.savings_accounts (id, workspace_id, student_id, balance) values
  ('e7000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 100),
  ('e7000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', 200),
  ('e7000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000003', 300);

insert into public.savings_transactions (id, workspace_id, account_id, student_id, transaction_type, amount, recorded_by) values
  ('e8000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'deposit', 100, 'e1000000-0000-4000-8000-000000000001'),
  ('e8000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000002', 'deposit', 200, 'e1000000-0000-4000-8000-000000000001'),
  ('e8000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e7000000-0000-4000-8000-000000000003', 'e4000000-0000-4000-8000-000000000003', 'deposit', 300, 'e1000000-0000-4000-8000-000000000003');

insert into public.behavior_records (id, workspace_id, student_id, category, description, recorded_by) values
  ('e9000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'ความรับผิดชอบ', 'Assigned behavior', 'e1000000-0000-4000-8000-000000000001'),
  ('e9000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', 'ความรับผิดชอบ', 'Unassigned behavior', 'e1000000-0000-4000-8000-000000000001'),
  ('e9000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000003', 'ความรับผิดชอบ', 'Free behavior', 'e1000000-0000-4000-8000-000000000003');

insert into public.student_health_records (id, workspace_id, classroom_id, student_id, record_date, record_type, status, inspection_results, note, recorded_by) values
  ('ea000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', current_date, 'hygiene', 'normal', '{}', 'Assigned health', 'e1000000-0000-4000-8000-000000000001'),
  ('ea000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000002', current_date, 'hygiene', 'normal', '{}', 'Unassigned health', 'e1000000-0000-4000-8000-000000000001'),
  ('ea000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000003', 'e4000000-0000-4000-8000-000000000003', current_date, 'hygiene', 'normal', '{}', 'Free health', 'e1000000-0000-4000-8000-000000000003');

insert into public.student_home_visits (id, workspace_id, student_id, academic_year, term, status, form_data, address_text, consent_accepted, visited_by) values
  ('eb000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', '2569', '1', 'draft', '{}', 'Assigned home', true, 'e1000000-0000-4000-8000-000000000001'),
  ('eb000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', '2569', '1', 'draft', '{}', 'Unassigned home', true, 'e1000000-0000-4000-8000-000000000001'),
  ('eb000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000003', '2569', '1', 'draft', '{}', 'Free home', true, 'e1000000-0000-4000-8000-000000000003');

-- Integrity triggers must reject cross-record mismatches even for a database-level writer.
do $$
begin
  begin
    insert into public.score_entries (workspace_id, assessment_id, student_id, score)
    values ('e2000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', 99);
    raise exception 'integrity accepted score from another classroom';
  exception when others then
    if sqlerrm <> 'score_entry_scope_mismatch' then raise; end if;
  end;

  begin
    insert into public.savings_transactions (workspace_id, account_id, student_id, transaction_type, amount)
    values ('e2000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', 'deposit', 1);
    raise exception 'integrity accepted savings account from another student';
  exception when others then
    if sqlerrm <> 'savings_transaction_account_scope_mismatch' then raise; end if;
  end;

  begin
    insert into public.student_health_records (workspace_id, classroom_id, student_id, record_date, record_type, status)
    values ('e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', current_date + 1, 'hygiene', 'normal');
    raise exception 'integrity accepted health classroom mismatch';
  exception when others then
    if sqlerrm <> 'health_record_scope_mismatch' then raise; end if;
  end;

  begin
    insert into public.behavior_records (workspace_id, student_id, category, description)
    values ('e2000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000001', 'invalid', 'cross workspace');
    raise exception 'integrity accepted cross-workspace behavior';
  exception when others then
    if sqlerrm <> 'student_activity_workspace_mismatch' then raise; end if;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.score_assessments) <> 1
    or (select count(*) from public.score_entries) <> 1
    or (select count(*) from public.savings_accounts) <> 1
    or (select count(*) from public.savings_transactions) <> 1
    or (select count(*) from public.behavior_records) <> 1
    or (select count(*) from public.student_health_records) <> 1
    or (select count(*) from public.student_home_visits) <> 1 then
    raise exception 'RLS teacher sensitive read scope failed';
  end if;

  update public.score_entries set score = 81 where id = 'e6000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RLS teacher score write failed'; end if;

  update public.behavior_records set points = 1 where id = 'e9000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RLS teacher behavior write failed'; end if;

  update public.student_health_records set note = 'teacher-write-ok' where id = 'ea000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RLS teacher health write failed'; end if;

  update public.student_home_visits set completion_percent = 10 where id = 'eb000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RLS teacher home visit write failed'; end if;

  update public.savings_accounts set balance = 101 where id = 'e7000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS teacher default savings restriction failed'; end if;

  update public.score_entries set score = 99 where id = 'e6000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS teacher wrote unassigned score'; end if;
end;
$$;

reset role;
update public.workspace_memberships
set permissions = '{"savings.write":true}'::jsonb
where workspace_id = 'e2000000-0000-4000-8000-000000000001'
  and profile_id = 'e1000000-0000-4000-8000-000000000002';
set local role authenticated;

do $$
declare affected integer;
begin
  update public.savings_accounts set balance = 101 where id = 'e7000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RLS teacher savings override failed'; end if;

  insert into public.savings_transactions (workspace_id, account_id, student_id, transaction_type, amount, recorded_by)
  values ('e2000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'deposit', 1, 'e1000000-0000-4000-8000-000000000002');
end;
$$;

reset role;
update public.workspace_memberships
set role = 'viewer', permissions = '{}'::jsonb
where workspace_id = 'e2000000-0000-4000-8000-000000000001'
  and profile_id = 'e1000000-0000-4000-8000-000000000002';
set local role authenticated;

do $$
declare affected integer;
begin
  if exists (select 1 from public.score_assessments)
    or exists (select 1 from public.score_entries)
    or exists (select 1 from public.savings_accounts)
    or exists (select 1 from public.savings_transactions)
    or exists (select 1 from public.behavior_records)
    or exists (select 1 from public.student_health_records)
    or exists (select 1 from public.student_home_visits) then
    raise exception 'RLS viewer saw sensitive raw activity';
  end if;

  update public.student_health_records set note = 'must-not-write' where id = 'ea000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS viewer updated health record'; end if;

  begin
    insert into public.behavior_records (workspace_id, student_id, category, description, recorded_by)
    values ('e2000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'denied', 'denied', 'e1000000-0000-4000-8000-000000000002');
    raise exception 'RLS viewer inserted behavior record';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000003', true);

do $$
begin
  if exists (select 1 from public.score_assessments)
    or exists (select 1 from public.score_entries)
    or exists (select 1 from public.savings_accounts)
    or exists (select 1 from public.savings_transactions)
    or exists (select 1 from public.behavior_records)
    or exists (select 1 from public.student_health_records)
    or exists (select 1 from public.student_home_visits) then
    raise exception 'RLS Free/other workspace owner saw premium or foreign raw activity';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS: scores, savings, behavior, health, home visits; relationship integrity, teacher scope/capabilities, viewer, Free/other workspace; transaction rolled back' as rls_sensitive_activity_roles;
