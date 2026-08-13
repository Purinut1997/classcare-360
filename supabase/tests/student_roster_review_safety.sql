-- Remote-safe roster review and deletion smoke test. All fixtures are rolled back.
-- Run: npx supabase db query --linked --file supabase/tests/student_roster_review_safety.sql

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roster-owner@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roster-member@example.invalid', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, email, display_name, account_status) values
  ('91000000-0000-4000-8000-000000000001', 'roster-owner@example.invalid', 'Roster Owner', 'active'),
  ('91000000-0000-4000-8000-000000000002', 'roster-member@example.invalid', 'Roster Member', 'active');

insert into public.workspaces (id, name, owner_profile_id, academic_year) values
  ('92000000-0000-4000-8000-000000000001', 'Roster Workspace', '91000000-0000-4000-8000-000000000001', '2569'),
  ('92000000-0000-4000-8000-000000000002', 'Other Workspace', '91000000-0000-4000-8000-000000000002', '2569');

insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'teacher_owner', 'active', now()),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'teacher_member', 'active', now()),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'teacher_owner', 'active', now());

insert into public.students (id, workspace_id, student_code, first_name, last_name, status) values
  ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'REVIEW-01', 'Duplicate', 'Student', 'active'),
  ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'REVIEW-02', 'Wrong', 'Workspace', 'archived'),
  ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 'REVIEW-03', 'Other', 'Student', 'archived');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select public.set_student_roster_reviews(
  '92000000-0000-4000-8000-000000000001',
  array['93000000-0000-4000-8000-000000000001']::uuid[],
  'duplicate',
  'confirmed duplicate fixture'
);

select public.set_student_roster_reviews(
  '92000000-0000-4000-8000-000000000001',
  array['93000000-0000-4000-8000-000000000002']::uuid[],
  'wrong_workspace',
  'keep archived for manual reconciliation'
);

do $$
begin
  if (select count(*) from public.student_roster_reviews
      where workspace_id = '92000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'owner review write or RLS read failed';
  end if;

  begin
    perform public.delete_reviewed_duplicate_students(
      '92000000-0000-4000-8000-000000000001',
      array['93000000-0000-4000-8000-000000000001']::uuid[]
    );
    raise exception 'active duplicate was deleted without archive';
  exception when others then
    if sqlerrm = 'active duplicate was deleted without archive' then raise; end if;
  end;

  begin
    perform public.set_student_roster_reviews(
      '92000000-0000-4000-8000-000000000001',
      array['93000000-0000-4000-8000-000000000003']::uuid[],
      'duplicate',
      null
    );
    raise exception 'cross-workspace student was reviewed';
  exception when others then
    if sqlerrm = 'cross-workspace student was reviewed' then raise; end if;
  end;
end;
$$;

reset role;
update public.students
set status = 'archived'
where id = '93000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select public.delete_reviewed_duplicate_students(
  '92000000-0000-4000-8000-000000000001',
  array['93000000-0000-4000-8000-000000000001']::uuid[]
);

do $$
begin
  if exists (select 1 from public.students where id = '93000000-0000-4000-8000-000000000001') then
    raise exception 'reviewed archived duplicate was not deleted';
  end if;
  if not exists (
    select 1 from public.trash_items
    where workspace_id = '92000000-0000-4000-8000-000000000001'
      and entity_id = '93000000-0000-4000-8000-000000000001'
      and reason = 'reviewed_duplicate'
      and payload->>'student_code' = 'REVIEW-01'
  ) then
    raise exception 'deleted duplicate snapshot was not retained';
  end if;
  if not exists (select 1 from public.students where id = '93000000-0000-4000-8000-000000000002') then
    raise exception 'wrong-workspace review was deleted unexpectedly';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.student_roster_reviews
      where workspace_id = '92000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'teacher member saw owner-only roster reviews';
  end if;

  begin
    perform public.set_student_roster_reviews(
      '92000000-0000-4000-8000-000000000001',
      array['93000000-0000-4000-8000-000000000002']::uuid[],
      'duplicate',
      null
    );
    raise exception 'teacher member changed owner-only roster review';
  exception when others then
    if sqlerrm = 'teacher member changed owner-only roster review' then raise; end if;
  end;
end;
$$;

rollback;
