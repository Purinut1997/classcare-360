-- ClassCare 360 - deterministic teacher automation, early warning, and approval-first communication.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in (
    'attendance_absence', 'low_score', 'negative_behavior',
    'attendance_today', 'savings_anomaly', 'home_visit_incomplete'
  )),
  action_type text not null check (action_type in (
    'open_care_case', 'add_watchlist', 'notify_teacher',
    'prepare_guardian_message', 'notify_manager', 'remind_teacher'
  )),
  threshold numeric(10,2) not null default 1,
  window_days integer not null default 7 check (window_days between 1 and 365),
  is_active boolean not null default true,
  approval_required boolean not null default true,
  config jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, trigger_type)
);

create table if not exists public.early_warning_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  signal_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  risk_score numeric(6,2) not null default 0 check (risk_score between 0 and 100),
  reason text not null,
  evidence jsonb not null default '{}',
  evaluation_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id, signal_type, evaluation_date)
);

create table if not exists public.communication_approval_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_name text,
  channels text[] not null default array['in_app']::text[],
  title text not null,
  body text not null,
  reason text not null,
  source_type text not null,
  source_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'sent', 'failed', 'cancelled')),
  consent_snapshot jsonb not null default '{}',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  dispatch_result jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists communication_queue_source_recipient_idx
on public.communication_approval_queue (
  workspace_id, source_type, source_id, student_id, coalesce(recipient_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where status in ('pending', 'approved', 'sent');

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  evaluated_count integer not null default 0,
  created_count integer not null default 0,
  result jsonb not null default '{}',
  triggered_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists early_warning_workspace_status_idx
on public.early_warning_signals (workspace_id, status, risk_score desc);
create index if not exists communication_queue_workspace_status_idx
on public.communication_approval_queue (workspace_id, status, created_at desc);

drop trigger if exists automation_rules_touch_updated_at on public.automation_rules;
create trigger automation_rules_touch_updated_at before update on public.automation_rules
for each row execute function public.touch_updated_at();
drop trigger if exists early_warning_signals_touch_updated_at on public.early_warning_signals;
create trigger early_warning_signals_touch_updated_at before update on public.early_warning_signals
for each row execute function public.touch_updated_at();
drop trigger if exists communication_queue_touch_updated_at on public.communication_approval_queue;
create trigger communication_queue_touch_updated_at before update on public.communication_approval_queue
for each row execute function public.touch_updated_at();

alter table public.automation_rules enable row level security;
alter table public.early_warning_signals enable row level security;
alter table public.communication_approval_queue enable row level security;
alter table public.automation_runs enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'automation_rules', 'early_warning_signals', 'communication_approval_queue', 'automation_runs'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_teacher_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (
        public.is_superadmin() or public.has_workspace_role(workspace_id, array[''teacher_owner'', ''teacher_member''])
      ) with check (
        public.is_superadmin() or public.has_workspace_role(workspace_id, array[''teacher_owner'', ''teacher_member''])
      )',
      table_name || '_teacher_access', table_name
    );
  end loop;
end $$;

create or replace function public.seed_default_automation_rules(target_workspace_id uuid)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare inserted_count integer;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id, array['teacher_owner','teacher_member'])) then
    raise exception 'Not authorized';
  end if;

  insert into public.automation_rules
    (workspace_id, name, trigger_type, action_type, threshold, window_days, approval_required, created_by)
  values
    (target_workspace_id, 'ขาดเรียน 3 ครั้งใน 7 วัน', 'attendance_absence', 'open_care_case', 3, 7, true, auth.uid()),
    (target_workspace_id, 'คะแนนเฉลี่ยต่ำกว่า 50%', 'low_score', 'add_watchlist', 50, 30, true, auth.uid()),
    (target_workspace_id, 'พฤติกรรมลบสะสมเกินกำหนด', 'negative_behavior', 'notify_teacher', 5, 30, true, auth.uid()),
    (target_workspace_id, 'ขาดเรียนวันนี้', 'attendance_today', 'prepare_guardian_message', 1, 1, true, auth.uid()),
    (target_workspace_id, 'เงินออมมีรายการผิดปกติ', 'savings_anomaly', 'notify_manager', 1000, 7, true, auth.uid()),
    (target_workspace_id, 'แบบเยี่ยมบ้านยังไม่ครบ', 'home_visit_incomplete', 'remind_teacher', 100, 30, true, auth.uid())
  on conflict (workspace_id, trigger_type) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end $$;

create or replace function public.evaluate_early_warning_signals(target_workspace_id uuid)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare run_id uuid; evaluated integer := 0; created_rows integer := 0; row_count_value integer;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id, array['teacher_owner','teacher_member'])) then
    raise exception 'Not authorized';
  end if;

  insert into public.automation_runs (workspace_id, triggered_by)
  values (target_workspace_id, auth.uid()) returning id into run_id;

  with absence_counts as (
    select ar.student_id, count(*)::int as total
    from public.attendance_records ar
    join public.attendance_sessions s on s.id = ar.session_id
    where ar.workspace_id = target_workspace_id
      and ar.status = 'absent' and s.attendance_date >= current_date - 6
    group by ar.student_id
  )
  insert into public.early_warning_signals
    (workspace_id, student_id, signal_type, severity, risk_score, reason, evidence)
  select target_workspace_id, student_id, 'attendance_absence',
    case when total >= 5 then 'high' else 'medium' end,
    least(100, total * 20), format('ขาดเรียน %s ครั้งใน 7 วัน (เกณฑ์ 3 ครั้ง)', total),
    jsonb_build_object('absence_count', total, 'window_days', 7, 'threshold', 3)
  from absence_counts where total >= 3
  on conflict (workspace_id, student_id, signal_type, evaluation_date)
  do update set severity = excluded.severity, risk_score = excluded.risk_score,
    reason = excluded.reason, evidence = excluded.evidence, status = 'open';
  get diagnostics row_count_value = row_count; created_rows := created_rows + row_count_value;

  with score_rates as (
    select se.student_id, round(avg((se.score / nullif(sa.max_score, 0)) * 100), 2) as average_rate
    from public.score_entries se join public.score_assessments sa on sa.id = se.assessment_id
    where se.workspace_id = target_workspace_id and se.score is not null
      and sa.assessment_date >= current_date - 30
    group by se.student_id
  )
  insert into public.early_warning_signals
    (workspace_id, student_id, signal_type, severity, risk_score, reason, evidence)
  select target_workspace_id, student_id, 'low_score',
    case when average_rate < 35 then 'high' else 'medium' end,
    least(100, 100 - average_rate), format('คะแนนเฉลี่ย %s%% ใน 30 วัน ต่ำกว่าเกณฑ์ 50%%', average_rate),
    jsonb_build_object('average_percent', average_rate, 'window_days', 30, 'threshold_percent', 50)
  from score_rates where average_rate < 50
  on conflict (workspace_id, student_id, signal_type, evaluation_date)
  do update set severity = excluded.severity, risk_score = excluded.risk_score,
    reason = excluded.reason, evidence = excluded.evidence, status = 'open';
  get diagnostics row_count_value = row_count; created_rows := created_rows + row_count_value;

  with behavior_totals as (
    select student_id, sum(abs(points))::int as total
    from public.behavior_records
    where workspace_id = target_workspace_id and tone in ('concern','discipline')
      and behavior_date >= current_date - 29
    group by student_id
  )
  insert into public.early_warning_signals
    (workspace_id, student_id, signal_type, severity, risk_score, reason, evidence)
  select target_workspace_id, student_id, 'negative_behavior',
    case when total >= 10 then 'high' else 'medium' end,
    least(100, total * 8), format('คะแนนพฤติกรรมที่ต้องติดตามสะสม %s คะแนนใน 30 วัน', total),
    jsonb_build_object('negative_points', total, 'window_days', 30, 'threshold', 5)
  from behavior_totals where total >= 5
  on conflict (workspace_id, student_id, signal_type, evaluation_date)
  do update set severity = excluded.severity, risk_score = excluded.risk_score,
    reason = excluded.reason, evidence = excluded.evidence, status = 'open';
  get diagnostics row_count_value = row_count; created_rows := created_rows + row_count_value;

  insert into public.early_warning_signals
    (workspace_id, student_id, signal_type, severity, risk_score, reason, evidence)
  select target_workspace_id, st.id, 'home_visit_incomplete', 'low',
    greatest(0, 100 - coalesce(hv.completion_percent, 0)),
    format('แบบเยี่ยมบ้านสมบูรณ์ %s%% ยังไม่ครบ 100%%', coalesce(hv.completion_percent, 0)),
    jsonb_build_object('completion_percent', coalesce(hv.completion_percent, 0), 'threshold_percent', 100)
  from public.students st
  left join lateral (
    select completion_percent from public.student_home_visits
    where workspace_id = target_workspace_id and student_id = st.id and status <> 'archived'
    order by updated_at desc limit 1
  ) hv on true
  where st.workspace_id = target_workspace_id and st.status = 'active'
    and coalesce(hv.completion_percent, 0) < 100
  on conflict (workspace_id, student_id, signal_type, evaluation_date)
  do update set risk_score = excluded.risk_score, reason = excluded.reason,
    evidence = excluded.evidence, status = 'open';
  get diagnostics row_count_value = row_count; created_rows := created_rows + row_count_value;

  select count(*) into evaluated from public.students
  where workspace_id = target_workspace_id and status = 'active';

  update public.automation_runs set status = 'completed', evaluated_count = evaluated,
    created_count = created_rows, result = jsonb_build_object('signals', created_rows),
    finished_at = now() where id = run_id;
  return jsonb_build_object('run_id', run_id, 'evaluated', evaluated, 'signals', created_rows);
exception when others then
  if run_id is not null then
    update public.automation_runs set status = 'failed', result = jsonb_build_object('error', sqlerrm),
      finished_at = now() where id = run_id;
  end if;
  raise;
end $$;

grant execute on function public.seed_default_automation_rules(uuid) to authenticated;
grant execute on function public.evaluate_early_warning_signals(uuid) to authenticated;
