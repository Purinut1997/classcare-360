-- Safe scorebook destructive actions.
-- Score assessments affect reports, so deletion must run through explicit
-- database-side role checks instead of broad client-side delete policies.

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

grant execute on function public.delete_score_assessment_safely(uuid) to authenticated;
grant execute on function public.delete_score_entry_safely(uuid) to authenticated;
