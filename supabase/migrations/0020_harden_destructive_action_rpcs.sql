-- Harden destructive RPCs used by production UI.
-- Cloudflare/GitHub deploys frontend only; this SQL must be applied in Supabase
-- for permanent delete actions to work against the real database.

create or replace function public.delete_classroom_safely(target_classroom_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_name text;
  detached_students integer := 0;
  deleted_rows integer := 0;
begin
  select c.workspace_id, c.name
    into target_workspace_id, target_name
  from public.classrooms c
  where c.id = target_classroom_id;

  if target_workspace_id is null then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'classroom_id', target_classroom_id
    );
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not allowed to delete classroom'
      using errcode = '42501';
  end if;

  update public.students
  set classroom_id = null
  where classroom_id = target_classroom_id;
  get diagnostics detached_students = row_count;

  delete from public.classrooms
  where id = target_classroom_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'classroom_id', target_classroom_id,
    'workspace_id', target_workspace_id,
    'name', target_name,
    'detached_students', detached_students
  );
end;
$$;

create or replace function public.delete_workspace_safely(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_name text;
  classroom_count integer := 0;
  student_count integer := 0;
  member_count integer := 0;
  deleted_rows integer := 0;
begin
  select w.name
    into target_name
  from public.workspaces w
  where w.id = target_workspace_id;

  if target_name is null then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'workspace_id', target_workspace_id
    );
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not allowed to delete workspace'
      using errcode = '42501';
  end if;

  select count(*) into classroom_count
  from public.classrooms
  where workspace_id = target_workspace_id;

  select count(*) into student_count
  from public.students
  where workspace_id = target_workspace_id;

  select count(*) into member_count
  from public.workspace_memberships
  where workspace_id = target_workspace_id;

  -- Break restrictive optional links before the workspace cascade runs.
  -- Several tables point at app_files/payment_requests without on delete cascade.
  update public.workspaces
  set logo_file_id = null
  where id = target_workspace_id;

  update public.subscriptions
  set payment_request_id = null
  where workspace_id = target_workspace_id;

  update public.referral_credits
  set used_payment_request_id = null
  where used_payment_request_id in (
    select pr.id
    from public.payment_requests pr
    where pr.workspace_id = target_workspace_id
  );

  update public.referral_events
  set payment_request_id = null
  where payment_request_id in (
    select pr.id
    from public.payment_requests pr
    where pr.workspace_id = target_workspace_id
  );

  delete from public.refund_requests
  where workspace_id = target_workspace_id;

  update public.payment_requests
  set qr_code_id = null,
      slip_file_id = null
  where workspace_id = target_workspace_id;

  delete from public.payment_qr_codes
  where file_id in (
    select af.id
    from public.app_files af
    where af.workspace_id = target_workspace_id
  );

  update public.import_jobs
  set source_file_id = null
  where workspace_id = target_workspace_id;

  update public.workspace_backups
  set file_id = null
  where workspace_id = target_workspace_id;

  delete from public.workspaces
  where id = target_workspace_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'workspace_id', target_workspace_id,
    'name', target_name,
    'counts', jsonb_build_object(
      'classrooms', classroom_count,
      'students', student_count,
      'members', member_count
    )
  );
end;
$$;

create or replace function public.delete_score_assessment_safely(target_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_classroom_id uuid;
  target_title text;
  target_subject text;
  entry_count integer := 0;
  deleted_rows integer := 0;
begin
  select a.workspace_id, a.classroom_id, a.title, a.subject_name
    into target_workspace_id, target_classroom_id, target_title, target_subject
  from public.score_assessments a
  where a.id = target_assessment_id;

  if target_workspace_id is null then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'assessment_id', target_assessment_id
    );
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner', 'teacher_member'])
  ) then
    raise exception 'not allowed to delete score assessment'
      using errcode = '42501';
  end if;

  select count(*) into entry_count
  from public.score_entries
  where assessment_id = target_assessment_id;

  delete from public.score_assessments
  where id = target_assessment_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'assessment_id', target_assessment_id,
    'workspace_id', target_workspace_id,
    'classroom_id', target_classroom_id,
    'title', target_title,
    'subject_name', target_subject,
    'deleted_entries', entry_count
  );
end;
$$;

create or replace function public.delete_score_entry_safely(target_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  target_assessment_id uuid;
  target_student_id uuid;
  deleted_rows integer := 0;
begin
  select e.workspace_id, e.assessment_id, e.student_id
    into target_workspace_id, target_assessment_id, target_student_id
  from public.score_entries e
  where e.id = target_entry_id;

  if target_workspace_id is null then
    return jsonb_build_object(
      'deleted', false,
      'reason', 'not_found',
      'entry_id', target_entry_id
    );
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner', 'teacher_member'])
  ) then
    raise exception 'not allowed to delete score entry'
      using errcode = '42501';
  end if;

  delete from public.score_entries
  where id = target_entry_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object(
    'deleted', deleted_rows > 0,
    'reason', case when deleted_rows > 0 then 'deleted' else 'not_deleted' end,
    'entry_id', target_entry_id,
    'workspace_id', target_workspace_id,
    'assessment_id', target_assessment_id,
    'student_id', target_student_id
  );
end;
$$;

grant execute on function public.delete_classroom_safely(uuid) to authenticated;
grant execute on function public.delete_workspace_safely(uuid) to authenticated;
grant execute on function public.delete_score_assessment_safely(uuid) to authenticated;
grant execute on function public.delete_score_entry_safely(uuid) to authenticated;
