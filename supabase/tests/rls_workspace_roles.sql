-- Remote-safe RLS smoke test. All fixtures are rolled back.
-- Run: npx supabase db query --linked --file supabase/tests/rls_workspace_roles.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-member@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-outsider@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status) values
  ('a1000000-0000-4000-8000-000000000001', 'rls-owner@example.invalid', 'RLS Owner', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'rls-member@example.invalid', 'RLS Member', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'rls-outsider@example.invalid', 'RLS Outsider', 'active');

insert into public.workspaces (id, name, owner_profile_id, academic_year) values
  ('b1000000-0000-4000-8000-000000000001', 'RLS Workspace A', 'a1000000-0000-4000-8000-000000000001', '2569'),
  ('b1000000-0000-4000-8000-000000000002', 'RLS Workspace B', 'a1000000-0000-4000-8000-000000000003', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now()),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'teacher_member', 'active', now()),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', 'teacher_owner', 'active', now());

insert into public.classrooms (id, workspace_id, name, status) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Assigned room', 'active'),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Unassigned room', 'archived'),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'Other workspace room', 'active');

insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');

insert into public.students (id, workspace_id, classroom_id, student_code, first_name, last_name, status) values
  ('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'RLS-A-01', 'Assigned', 'Student', 'active'),
  ('d1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'RLS-A-02', 'Unassigned', 'Student', 'active'),
  ('d1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 'RLS-B-01', 'Other', 'Student', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

do $$
begin
  if (select count(*) from public.students) <> 2 then
    raise exception 'RLS owner scope failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.students) <> 1 then
    raise exception 'RLS teacher classroom read scope failed';
  end if;

  update public.students set nickname = 'teacher-write-ok'
  where id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'RLS teacher assigned-room write failed'; end if;

  update public.students set nickname = 'must-not-write'
  where id = 'd1000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS teacher wrote unassigned room'; end if;
end;
$$;

reset role;
update public.workspace_memberships
set permissions = '{"students.write":false}'::jsonb
where workspace_id = 'b1000000-0000-4000-8000-000000000001'
  and profile_id = 'a1000000-0000-4000-8000-000000000002';
set local role authenticated;

do $$
declare affected integer;
begin
  update public.students set nickname = 'must-not-write'
  where id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS read-only teacher updated student'; end if;

  begin
    insert into public.students (workspace_id, classroom_id, student_code, first_name, last_name)
    values ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'RLS-DENY-TEACHER', 'Denied', 'Teacher');
    raise exception 'RLS read-only teacher inserted student';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.workspace_memberships
set role = 'viewer', permissions = '{}'::jsonb
where workspace_id = 'b1000000-0000-4000-8000-000000000001'
  and profile_id = 'a1000000-0000-4000-8000-000000000002';
set local role authenticated;

do $$
declare affected integer;
begin
  if (select count(*) from public.students) <> 1 then
    raise exception 'RLS viewer classroom read scope failed';
  end if;

  update public.students set nickname = 'must-not-write'
  where id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS viewer updated student'; end if;

  delete from public.students where id = 'd1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS viewer deleted student'; end if;

  begin
    insert into public.students (workspace_id, classroom_id, student_code, first_name, last_name)
    values ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'RLS-DENY-VIEWER', 'Denied', 'Viewer');
    raise exception 'RLS viewer inserted student';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);

do $$
begin
  if exists (
    select 1 from public.students
    where workspace_id = 'b1000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'RLS outsider saw another workspace';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS: owner, teacher, read-only teacher, viewer, outsider; transaction rolled back' as rls_workspace_roles;
