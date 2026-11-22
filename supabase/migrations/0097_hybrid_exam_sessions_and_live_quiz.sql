-- Hybrid Exam Sessions & Live Classroom Quiz (Step B & Step C)
-- Strictly additive & multi-tenant safe (Expand-and-Contract compliant).

-- 1. Ensure score_assessments exposes a composite (id, workspace_id) key for composite FK integrity
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'score_assessments_id_workspace_key'
      and conrelid = 'public.score_assessments'::regclass
  ) then
    alter table public.score_assessments
      add constraint score_assessments_id_workspace_key unique (id, workspace_id);
  end if;
end $$;

-- 2. Online Exam & Live Quiz Sessions (Mobile Exam + Kahoot-style Live Quiz)
create table if not exists public.online_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid,
  assessment_id uuid,
  pin_code text not null unique,
  mode text not null default 'mobile_exam'
    check (mode in ('mobile_exam', 'live_quiz')),
  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'revealed', 'closed')),
  current_question_index integer not null default 0
    check (current_question_index >= 0),
  title text not null,
  subject_name text not null default 'วิชาทั่วไป',
  exam_payload jsonb not null default '{}'::jsonb,
  answer_key_payload jsonb not null default '{}'::jsonb,
  time_limit_minutes integer not null default 0
    check (time_limit_minutes >= 0),
  show_score_immediately boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint online_exam_sessions_id_workspace_key unique (id, workspace_id),
  constraint online_exam_sessions_classroom_workspace_fkey
    foreign key (classroom_id, workspace_id)
    references public.classrooms (id, workspace_id)
    on delete set null (classroom_id),
  constraint online_exam_sessions_assessment_workspace_fkey
    foreign key (assessment_id, workspace_id)
    references public.score_assessments (id, workspace_id)
    on delete set null (assessment_id)
);

create index if not exists online_exam_sessions_workspace_created_idx
  on public.online_exam_sessions (workspace_id, created_at desc);

create index if not exists online_exam_sessions_pin_idx
  on public.online_exam_sessions (pin_code);

drop trigger if exists online_exam_sessions_touch_updated_at on public.online_exam_sessions;
create trigger online_exam_sessions_touch_updated_at
before update on public.online_exam_sessions
for each row execute function public.touch_updated_at();

alter table public.online_exam_sessions enable row level security;

drop policy if exists "online_exam_sessions_select_member" on public.online_exam_sessions;
create policy "online_exam_sessions_select_member"
on public.online_exam_sessions
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "online_exam_sessions_write_teacher" on public.online_exam_sessions;
create policy "online_exam_sessions_write_teacher"
on public.online_exam_sessions
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 3. Student Exam & Live Quiz Submissions
create table if not exists public.online_exam_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null,
  student_id uuid,
  student_code text,
  student_name text not null,
  nickname text,
  answers jsonb not null default '{}'::jsonb,
  flagged_questions jsonb not null default '[]'::jsonb,
  score numeric(8,2) not null default 0,
  max_score numeric(8,2) not null default 0,
  live_points integer not null default 0,
  synced_to_gradebook boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint online_exam_submissions_session_workspace_fkey
    foreign key (session_id, workspace_id)
    references public.online_exam_sessions (id, workspace_id)
    on delete cascade,
  constraint online_exam_submissions_student_workspace_fkey
    foreign key (student_id, workspace_id)
    references public.students (id, workspace_id)
    on delete cascade
);

create index if not exists online_exam_submissions_workspace_session_idx
  on public.online_exam_submissions (workspace_id, session_id, live_points desc, score desc);

create unique index if not exists online_exam_submissions_session_identity_uidx
  on public.online_exam_submissions (
    session_id,
    lower(trim(coalesce(nullif(student_code, ''), student_name)))
  );

drop trigger if exists online_exam_submissions_touch_updated_at on public.online_exam_submissions;
create trigger online_exam_submissions_touch_updated_at
before update on public.online_exam_submissions
for each row execute function public.touch_updated_at();

alter table public.online_exam_submissions enable row level security;

drop policy if exists "online_exam_submissions_select_member" on public.online_exam_submissions;
create policy "online_exam_submissions_select_member"
on public.online_exam_submissions
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "online_exam_submissions_write_teacher" on public.online_exam_submissions;
create policy "online_exam_submissions_write_teacher"
on public.online_exam_submissions
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 4. Helper: Normalize Thai/Arabic digits and whitespace for lenient short-answer grading
create or replace function public.normalize_exam_answer_text(p_text text, p_strictness text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text := coalesce(p_text, '');
begin
  if p_strictness = 'strict' then
    return trim(cleaned);
  end if;

  cleaned := lower(trim(regexp_replace(cleaned, '\s+', ' ', 'g')));
  if p_strictness = 'lenient' then
    cleaned := translate(cleaned, '๐๑๒๓๔๕๖๗๘๙', '0123456789');
    cleaned := replace(cleaned, ' ', '');
  end if;
  return cleaned;
end;
$$;

-- 5. Public PIN Join RPC (does NOT return answer_key_payload)
create or replace function public.join_online_exam_by_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.online_exam_sessions%rowtype;
  v_students jsonb := '[]'::jsonb;
  v_classroom_name text := null;
begin
  select *
  into v_session
  from public.online_exam_sessions
  where pin_code = trim(coalesce(p_pin, ''))
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('found', false, 'error', 'ไม่พบห้องสอบจากรหัส PIN นี้');
  end if;

  if v_session.status = 'closed' then
    return jsonb_build_object('found', false, 'error', 'ห้องสอบนี้ปิดรับคำตอบแล้ว');
  end if;

  if v_session.classroom_id is not null then
    select name into v_classroom_name
    from public.classrooms
    where id = v_session.classroom_id
      and workspace_id = v_session.workspace_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'student_code', coalesce(s.student_code, ''),
          'first_name', s.first_name,
          'last_name', s.last_name
        )
        order by s.student_code nulls last, s.first_name
      ),
      '[]'::jsonb
    )
    into v_students
    from public.students s
    where s.workspace_id = v_session.workspace_id
      and s.classroom_id = v_session.classroom_id
      and s.status = 'active';
  end if;

  return jsonb_build_object(
    'found', true,
    'session', jsonb_build_object(
      'id', v_session.id,
      'pin_code', v_session.pin_code,
      'mode', v_session.mode,
      'status', v_session.status,
      'current_question_index', v_session.current_question_index,
      'title', v_session.title,
      'subject_name', v_session.subject_name,
      'classroom_name', v_classroom_name,
      'exam_payload', v_session.exam_payload,
      'time_limit_minutes', v_session.time_limit_minutes,
      'show_score_immediately', v_session.show_score_immediately
    ),
    'students', v_students
  );
end;
$$;

revoke all on function public.join_online_exam_by_pin(text) from public;
grant execute on function public.join_online_exam_by_pin(text) to anon, authenticated;

-- 6. Public Submit & Server-Side Auto-Grading RPC
create or replace function public.submit_online_exam_attempt(
  p_pin text,
  p_student_name text,
  p_student_code text default null,
  p_student_id uuid default null,
  p_nickname text default null,
  p_answers jsonb default '{}'::jsonb,
  p_flagged jsonb default '[]'::jsonb,
  p_live_points integer default 0,
  p_finalize boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.online_exam_sessions%rowtype;
  v_keys jsonb;
  v_strictness text;
  v_q jsonb;
  v_q_num text;
  v_q_type text;
  v_pts numeric(8,2);
  v_score numeric(8,2) := 0;
  v_max_score numeric(8,2) := 0;
  v_ans jsonb;
  v_correct_single text;
  v_expected_multi text[];
  v_actual_multi text[];
  v_accepted_elem text;
  v_ans_norm text;
  v_matched boolean;
  v_safe_name text := trim(coalesce(p_student_name, ''));
  v_safe_code text := nullif(trim(coalesce(p_student_code, '')), '');
  v_safe_student_id uuid := null;
  v_identity_key text;
  v_submission_id uuid;
  v_leaderboard jsonb := '[]'::jsonb;
begin
  if v_safe_name = '' then
    raise exception 'student_name_required';
  end if;

  select *
  into v_session
  from public.online_exam_sessions
  where pin_code = trim(coalesce(p_pin, ''))
  limit 1;

  if v_session.id is null then
    raise exception 'exam_session_not_found';
  end if;

  if v_session.status = 'closed' then
    raise exception 'exam_session_closed';
  end if;

  if p_student_id is not null then
    select id into v_safe_student_id
    from public.students
    where id = p_student_id
      and workspace_id = v_session.workspace_id
    limit 1;
  end if;

  v_keys := coalesce(v_session.answer_key_payload, '{}'::jsonb);
  v_strictness := coalesce(v_keys ->> 'strictness', 'normal');

  for v_q in
    select value
    from jsonb_array_elements(coalesce(v_keys -> 'questions', '[]'::jsonb))
  loop
    v_q_num := coalesce(v_q ->> 'number', '');
    v_q_type := coalesce(v_q ->> 'type', 'single_choice');
    v_pts := coalesce((v_q ->> 'points')::numeric, 1);
    v_max_score := v_max_score + v_pts;
    v_ans := p_answers -> v_q_num;

    if v_ans is null or jsonb_typeof(v_ans) = 'null' then
      continue;
    end if;

    if v_q_type = 'single_choice' then
      v_correct_single := upper(trim(coalesce(v_q ->> 'correctChoice', '')));
      if v_correct_single <> '' and upper(trim(coalesce(p_answers ->> v_q_num, ''))) = v_correct_single then
        v_score := v_score + v_pts;
      end if;
    elsif v_q_type = 'multiple_choice' then
      select coalesce(array_agg(upper(trim(val)) order by upper(trim(val))), array[]::text[])
      into v_expected_multi
      from jsonb_array_elements_text(coalesce(v_q -> 'correctChoices', '[]'::jsonb)) as val
      where trim(val) <> '';

      if jsonb_typeof(v_ans) = 'array' then
        select coalesce(array_agg(upper(trim(val)) order by upper(trim(val))), array[]::text[])
        into v_actual_multi
        from jsonb_array_elements_text(v_ans) as val
        where trim(val) <> '';
      else
        v_actual_multi := array[upper(trim(coalesce(p_answers ->> v_q_num, '')))];
      end if;

      if cardinality(v_expected_multi) > 0 and v_expected_multi = v_actual_multi then
        v_score := v_score + v_pts;
      end if;
    elsif v_q_type = 'short_answer' then
      v_ans_norm := public.normalize_exam_answer_text(p_answers ->> v_q_num, v_strictness);
      v_matched := false;
      if v_ans_norm <> '' then
        for v_accepted_elem in
          select val
          from jsonb_array_elements_text(coalesce(v_q -> 'acceptedTextAnswers', '[]'::jsonb)) as val
        loop
          if public.normalize_exam_answer_text(v_accepted_elem, v_strictness) = v_ans_norm then
            v_matched := true;
            exit;
          end if;
        end loop;
      end if;
      if v_matched then
        v_score := v_score + v_pts;
      end if;
    end if;
  end loop;

  v_identity_key := lower(trim(coalesce(v_safe_code, v_safe_name)));

  select id
  into v_submission_id
  from public.online_exam_submissions
  where session_id = v_session.id
    and lower(trim(coalesce(nullif(student_code, ''), student_name))) = v_identity_key
  limit 1;

  if v_submission_id is null then
    insert into public.online_exam_submissions (
      workspace_id,
      session_id,
      student_id,
      student_code,
      student_name,
      nickname,
      answers,
      flagged_questions,
      score,
      max_score,
      live_points,
      submitted_at
    )
    values (
      v_session.workspace_id,
      v_session.id,
      v_safe_student_id,
      v_safe_code,
      v_safe_name,
      nullif(trim(coalesce(p_nickname, '')), ''),
      coalesce(p_answers, '{}'::jsonb),
      coalesce(p_flagged, '[]'::jsonb),
      v_score,
      v_max_score,
      greatest(0, coalesce(p_live_points, 0)),
      case when p_finalize then now() else null end
    )
    returning id into v_submission_id;
  else
    update public.online_exam_submissions
    set
      student_id = coalesce(v_safe_student_id, student_id),
      student_name = v_safe_name,
      nickname = coalesce(nullif(trim(coalesce(p_nickname, '')), ''), nickname),
      answers = coalesce(p_answers, '{}'::jsonb),
      flagged_questions = coalesce(p_flagged, '[]'::jsonb),
      score = v_score,
      max_score = v_max_score,
      live_points = greatest(live_points, greatest(0, coalesce(p_live_points, 0))),
      submitted_at = case when p_finalize then coalesce(submitted_at, now()) else submitted_at end
    where id = v_submission_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'submission_id', sub.id,
        'display_name', coalesce(nullif(sub.nickname, ''), sub.student_name),
        'live_points', sub.live_points,
        'score', sub.score
      )
      order by sub.live_points desc, sub.score desc, sub.created_at asc
    ),
    '[]'::jsonb
  )
  into v_leaderboard
  from (
    select id, nickname, student_name, live_points, score, created_at
    from public.online_exam_submissions
    where session_id = v_session.id
    order by live_points desc, score desc, created_at asc
    limit 10
  ) sub;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'score', case when v_session.show_score_immediately then v_score else null end,
    'max_score', v_max_score,
    'live_points', greatest(0, coalesce(p_live_points, 0)),
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke all on function public.submit_online_exam_attempt(text, text, text, uuid, text, jsonb, jsonb, integer, boolean) from public;
grant execute on function public.submit_online_exam_attempt(text, text, text, uuid, text, jsonb, jsonb, integer, boolean) to anon, authenticated;

-- 7. Live Quiz Public State Poll RPC
create or replace function public.get_live_quiz_public_state(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.online_exam_sessions%rowtype;
  v_participant_count integer := 0;
  v_answered_count integer := 0;
  v_q_key text;
  v_revealed_correct jsonb := null;
  v_leaderboard jsonb := '[]'::jsonb;
begin
  select *
  into v_session
  from public.online_exam_sessions
  where pin_code = trim(coalesce(p_pin, ''))
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*) into v_participant_count
  from public.online_exam_submissions
  where session_id = v_session.id;

  select q -> 'number'
  into v_q_key
  from (
    select value as q, ordinality - 1 as idx
    from jsonb_array_elements(coalesce(v_session.exam_payload -> 'questions', '[]'::jsonb)) with ordinality
  ) items
  where items.idx = v_session.current_question_index
  limit 1;

  v_q_key := trim(both '"' from coalesce(v_q_key::text, ''));

  if v_q_key <> '' then
    select count(*) into v_answered_count
    from public.online_exam_submissions
    where session_id = v_session.id
      and answers ? v_q_key;
  end if;

  if v_session.status = 'revealed' and v_q_key <> '' then
    select jsonb_build_object(
      'number', coalesce(q ->> 'number', v_q_key),
      'correctChoice', q -> 'correctChoice',
      'correctChoices', q -> 'correctChoices',
      'acceptedTextAnswers', q -> 'acceptedTextAnswers'
    )
    into v_revealed_correct
    from jsonb_array_elements(coalesce(v_session.answer_key_payload -> 'questions', '[]'::jsonb)) as q
    where (q ->> 'number') = v_q_key
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'submission_id', sub.id,
        'display_name', coalesce(nullif(sub.nickname, ''), sub.student_name),
        'live_points', sub.live_points,
        'score', sub.score
      )
      order by sub.live_points desc, sub.score desc, sub.created_at asc
    ),
    '[]'::jsonb
  )
  into v_leaderboard
  from (
    select id, nickname, student_name, live_points, score, created_at
    from public.online_exam_submissions
    where session_id = v_session.id
    order by live_points desc, score desc, created_at asc
    limit 10
  ) sub;

  return jsonb_build_object(
    'found', true,
    'status', v_session.status,
    'mode', v_session.mode,
    'current_question_index', v_session.current_question_index,
    'participant_count', v_participant_count,
    'answered_count', v_answered_count,
    'revealed_correct', v_revealed_correct,
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke all on function public.get_live_quiz_public_state(text) from public;
grant execute on function public.get_live_quiz_public_state(text) to anon, authenticated;
