-- Remote-safe regression test for migration 0063. All fixtures are rolled back.
-- Run: supabase db query --linked --file supabase/tests/runtime_logic_repairs.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'runtime-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'runtime-viewer@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'runtime-superadmin@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status, metadata) values
  ('e1000000-0000-4000-8000-000000000001', 'runtime-owner@example.invalid', 'Runtime Owner', 'active', '{"school_name":"Runtime School"}'),
  ('e1000000-0000-4000-8000-000000000002', 'runtime-viewer@example.invalid', 'Runtime Viewer', 'active', '{"school_name":"Runtime School"}'),
  ('e1000000-0000-4000-8000-000000000003', 'runtime-superadmin@example.invalid', 'Runtime Superadmin', 'active', '{}');

insert into public.superadmin_profiles (profile_id, is_active) values ('e1000000-0000-4000-8000-000000000003', true);

insert into public.workspaces (id, name, school_name, owner_profile_id, academic_year) values
  ('e2000000-0000-4000-8000-000000000001', 'Runtime Workspace', 'Runtime School', 'e1000000-0000-4000-8000-000000000001', '2569'),
  ('e2000000-0000-4000-8000-000000000002', 'Runtime Join Target', 'Runtime School', 'e1000000-0000-4000-8000-000000000001', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now()),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now());

insert into public.subscriptions (workspace_id, profile_id, plan_id, status, starts_at, ends_at, source)
select 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', p.id,
  'active', now(), now() + interval '30 days', 'runtime_logic_test'
from public.plans p where p.code = 'VIP_YEARLY';

insert into public.classrooms (id, workspace_id, name, status) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Runtime Room', 'active');

insert into public.students (id, workspace_id, classroom_id, student_code, first_name, last_name, birth_date, status) values
  ('e4000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'RUNTIME-1', 'Runtime', 'Student', date '2015-01-01', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);

do $$
declare result jsonb;
begin
  if public.public_lookup_hash('e2000000-0000-4000-8000-000000000001', date '2015-01-01', '1100100000001') is null then
    raise exception 'public lookup hash returned null';
  end if;
  result := public.set_student_public_lookup_identity('e4000000-0000-4000-8000-000000000001', '1100100000001');
  if not coalesce((result->>'ok')::boolean, false) then raise exception 'student lookup identity failed'; end if;
end;
$$;

select * from public.add_workspace_member_by_email(
  'e2000000-0000-4000-8000-000000000001', 'RUNTIME-VIEWER@EXAMPLE.INVALID', 'viewer'
);
select * from public.set_workspace_member_status(
  'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'suspended'
);
select * from public.set_workspace_member_status(
  'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'active'
);

insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);

do $$
declare result jsonb;
begin
  result := public.get_workspace_viewer_report_summary(
    'e2000000-0000-4000-8000-000000000001', date '2026-08-01', date '2026-08-31'
  );
  if (result->>'student_count')::integer <> 1 or (result->>'classroom_count')::integer <> 1 then
    raise exception 'viewer report scope failed: %', result;
  end if;
end;
$$;

select * from public.request_workspace_access('e2000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000003', true);
do $$
declare result jsonb;
begin
  result := public.create_vip_redemption_code('Runtime test', 30, 1, now() + interval '1 day');
  if result->>'code' is null then raise exception 'VIP code generation failed'; end if;
end;
$$;

reset role;
set local role anon;
do $$
declare created jsonb; loaded jsonb;
begin
  created := public.create_public_support_ticket(
    'Runtime Tester', 'runtime-support@example.invalid', 'Runtime support', 'Regression test message',
    'other', 'public', '{}'::jsonb, ''
  );
  loaded := public.get_public_support_ticket(created->>'ticket_code', created->>'access_token');
  if loaded->'ticket'->>'subject' <> 'Runtime support' then raise exception 'public support lookup failed'; end if;
  if not public.reply_public_support_ticket(created->>'ticket_code', created->>'access_token', 'Follow-up') then
    raise exception 'public support reply failed';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS: runtime RPCs, crypto schema, member admin, join request, viewer aggregate and public support; transaction rolled back' as runtime_logic_repairs;
