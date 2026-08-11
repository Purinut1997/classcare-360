-- Repair public report RPCs that can be absent even when migration 0022 is marked applied.
-- Recreating them is idempotent and refreshes PostgREST-visible signatures.

create or replace function public.get_public_report_schools()
returns table (
  workspace_id uuid,
  school_name text,
  academic_year text,
  enabled boolean
)
language sql
security definer
set search_path = public
as $$
  select
    w.id as workspace_id,
    coalesce(w.school_name, w.name) as school_name,
    w.academic_year,
    coalesce((w.settings->'public_report'->>'enabled')::boolean, false) as enabled
  from public.workspaces w
  where w.archived_at is null
    and coalesce((w.settings->'public_report'->>'enabled')::boolean, false) = true
  order by coalesce(w.school_name, w.name), w.academic_year desc nulls last
$$;

create or replace function public.lookup_public_student_report(
  target_workspace_id uuid,
  citizen_id text,
  target_birth_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_record record;
  student_record record;
  policy jsonb;
  normalized_id text := public.normalize_thai_citizen_id(citizen_id);
  lookup_hash text;
  attendance_payload jsonb := 'null'::jsonb;
  scores_payload jsonb := 'null'::jsonb;
  savings_payload jsonb := 'null'::jsonb;
  behavior_payload jsonb := 'null'::jsonb;
  home_visit_payload jsonb := 'null'::jsonb;
  guardians_payload jsonb := 'null'::jsonb;
begin
  if length(normalized_id) <> 13 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_identity');
  end if;

  select id, name, school_name, academic_year, settings
    into workspace_record
  from public.workspaces
  where id = target_workspace_id
    and archived_at is null;

  if workspace_record.id is null then
    return jsonb_build_object('ok', false, 'reason', 'workspace_not_found');
  end if;

  policy := coalesce(workspace_record.settings->'public_report', '{}'::jsonb);

  if not coalesce((policy->>'enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'public_report_disabled');
  end if;

  lookup_hash := public.public_lookup_hash(target_workspace_id, target_birth_date, normalized_id);

  select s.id,
         s.student_code,
         s.first_name,
         s.last_name,
         s.nickname,
         s.status,
         s.birth_date,
         c.name as classroom_name
    into student_record
  from public.students s
  left join public.classrooms c on c.id = s.classroom_id
  where s.workspace_id = target_workspace_id
    and s.birth_date = target_birth_date
    and s.status in ('active', 'transferred', 'graduated')
    and s.metadata->>'public_lookup_id_hash' = lookup_hash
  limit 1;

  if student_record.id is null then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  if coalesce((policy->>'attendance')::boolean, false) then
    select jsonb_build_object(
      'total', count(*),
      'present', count(*) filter (where ar.status = 'present'),
      'absent', count(*) filter (where ar.status = 'absent'),
      'late', count(*) filter (where ar.status = 'late'),
      'leave', count(*) filter (where ar.status = 'leave'),
      'latest', coalesce(jsonb_agg(
        jsonb_build_object(
          'date', ats.attendance_date,
          'period', ats.period_label,
          'subject', ats.subject_name,
          'status', ar.status,
          'note', ar.note
        )
        order by ats.attendance_date desc, ar.created_at desc
      ) filter (where ar.id is not null), '[]'::jsonb)
    )
      into attendance_payload
    from public.attendance_records ar
    join public.attendance_sessions ats on ats.id = ar.session_id
    where ar.workspace_id = target_workspace_id
      and ar.student_id = student_record.id;
  end if;

  if coalesce((policy->>'scores')::boolean, false) then
    select jsonb_build_object(
      'entries', count(se.*),
      'average_percent', round(avg((se.score / nullif(sa.max_score, 0)) * 100), 2),
      'latest', coalesce(jsonb_agg(
        jsonb_build_object(
          'title', sa.title,
          'subject', sa.subject_name,
          'score', se.score,
          'max_score', sa.max_score,
          'date', sa.assessment_date
        )
        order by sa.assessment_date desc nulls last, se.updated_at desc
      ) filter (where se.id is not null), '[]'::jsonb)
    )
      into scores_payload
    from public.score_entries se
    join public.score_assessments sa on sa.id = se.assessment_id
    where se.workspace_id = target_workspace_id
      and se.student_id = student_record.id;
  end if;

  if coalesce((policy->>'savings')::boolean, false) then
    select jsonb_build_object(
      'balance', coalesce(sa.balance, 0),
      'status', sa.status
    )
      into savings_payload
    from public.savings_accounts sa
    where sa.workspace_id = target_workspace_id
      and sa.student_id = student_record.id;
  end if;

  if coalesce((policy->>'behavior')::boolean, false) then
    select jsonb_build_object(
      'records', count(*),
      'positive', count(*) filter (where tone = 'positive'),
      'concern', count(*) filter (where tone = 'concern'),
      'follow_up', count(*) filter (where follow_up_status <> 'none')
    )
      into behavior_payload
    from public.behavior_records
    where workspace_id = target_workspace_id
      and student_id = student_record.id;
  end if;

  if coalesce((policy->>'home_visit')::boolean, false) then
    select jsonb_build_object(
      'status', status,
      'completion_percent', completion_percent,
      'updated_at', updated_at
    )
      into home_visit_payload
    from public.student_home_visits
    where workspace_id = target_workspace_id
      and student_id = student_record.id
    order by updated_at desc
    limit 1;
  end if;

  if coalesce((policy->>'guardians')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'relation', relation,
      'display_name', display_name,
      'is_primary', is_primary
    ) order by is_primary desc, created_at asc), '[]'::jsonb)
      into guardians_payload
    from public.student_guardians
    where workspace_id = target_workspace_id
      and student_id = student_record.id
      and consent_status = 'granted';
  end if;

  return jsonb_build_object(
    'ok', true,
    'workspace', jsonb_build_object(
      'id', workspace_record.id,
      'name', workspace_record.name,
      'school_name', workspace_record.school_name,
      'academic_year', workspace_record.academic_year
    ),
    'student', jsonb_build_object(
      'student_code', student_record.student_code,
      'first_name', student_record.first_name,
      'last_name', student_record.last_name,
      'nickname', student_record.nickname,
      'classroom_name', student_record.classroom_name,
      'status', student_record.status
    ),
    'policy', policy,
    'attendance', attendance_payload,
    'scores', scores_payload,
    'savings', savings_payload,
    'behavior', behavior_payload,
    'home_visit', home_visit_payload,
    'guardians', guardians_payload
  );
end;
$$;


grant execute on function public.get_public_report_schools() to authenticated, anon;
grant execute on function public.lookup_public_student_report(uuid, text, date) to authenticated, anon;

