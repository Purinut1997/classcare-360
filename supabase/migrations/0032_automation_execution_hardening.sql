-- Make approval dispatch idempotent and make automation rules drive evaluation.
alter table public.communication_approval_queue
  drop constraint if exists communication_approval_queue_status_check;
alter table public.communication_approval_queue
  add constraint communication_approval_queue_status_check
  check (status in ('pending','approved','sending','rejected','sent','failed','cancelled'));

create unique index if not exists student_care_cases_automation_open_idx
on public.student_care_cases (workspace_id, student_id, case_type)
where status in ('open','monitoring') and metadata->>'source' = 'automation';

create or replace function public.evaluate_early_warning_signals(target_workspace_id uuid)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  run_id uuid; evaluated integer := 0; affected integer := 0; n integer;
  absence_threshold numeric := null; absence_days integer := 7;
  score_threshold numeric := null; score_days integer := 30;
  behavior_threshold numeric := null; behavior_days integer := 30;
  savings_threshold numeric := null; savings_days integer := 7;
  today_rule boolean := false; visit_deadline date := null;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id, array['teacher_owner','teacher_member'])) then
    raise exception 'Not authorized';
  end if;
  insert into public.automation_runs (workspace_id, triggered_by)
  values (target_workspace_id, auth.uid()) returning id into run_id;

  select threshold, window_days into absence_threshold, absence_days from public.automation_rules
    where workspace_id=target_workspace_id and trigger_type='attendance_absence' and is_active limit 1;
  select threshold, window_days into score_threshold, score_days from public.automation_rules
    where workspace_id=target_workspace_id and trigger_type='low_score' and is_active limit 1;
  select threshold, window_days into behavior_threshold, behavior_days from public.automation_rules
    where workspace_id=target_workspace_id and trigger_type='negative_behavior' and is_active limit 1;
  select threshold, window_days into savings_threshold, savings_days from public.automation_rules
    where workspace_id=target_workspace_id and trigger_type='savings_anomaly' and is_active limit 1;
  select exists(select 1 from public.automation_rules where workspace_id=target_workspace_id and trigger_type='attendance_today' and is_active)
    into today_rule;
  select nullif(config->>'deadline','')::date into visit_deadline from public.automation_rules
    where workspace_id=target_workspace_id and trigger_type='home_visit_incomplete' and is_active limit 1;

  if absence_threshold is not null then
    with x as (
      select ar.student_id, count(*)::int total from public.attendance_records ar
      join public.attendance_sessions s on s.id=ar.session_id
      where ar.workspace_id=target_workspace_id and ar.status='absent'
        and s.attendance_date >= current_date-(absence_days-1)
      group by ar.student_id
    )
    insert into public.early_warning_signals(workspace_id,student_id,signal_type,severity,risk_score,reason,evidence)
    select target_workspace_id,student_id,'attendance_absence',
      case when total >= absence_threshold*2 then 'high' else 'medium' end,
      least(100,total*20),format('ขาดเรียน %s ครั้งใน %s วัน (เกณฑ์ %s ครั้ง)',total,absence_days,absence_threshold),
      jsonb_build_object('absence_count',total,'window_days',absence_days,'threshold',absence_threshold)
    from x where total>=absence_threshold
    on conflict(workspace_id,student_id,signal_type,evaluation_date) do update
      set severity=excluded.severity,risk_score=excluded.risk_score,reason=excluded.reason,evidence=excluded.evidence,status='open';
    get diagnostics n=row_count; affected:=affected+n;
  end if;

  if score_threshold is not null then
    with x as (
      select se.student_id,round(avg((se.score/nullif(sa.max_score,0))*100),2) rate
      from public.score_entries se join public.score_assessments sa on sa.id=se.assessment_id
      where se.workspace_id=target_workspace_id and se.score is not null
        and sa.assessment_date>=current_date-(score_days-1) group by se.student_id
    )
    insert into public.early_warning_signals(workspace_id,student_id,signal_type,severity,risk_score,reason,evidence)
    select target_workspace_id,student_id,'low_score',case when rate<score_threshold*.7 then 'high' else 'medium' end,
      least(100,100-rate),format('คะแนนเฉลี่ย %s%% ใน %s วัน ต่ำกว่าเกณฑ์ %s%%',rate,score_days,score_threshold),
      jsonb_build_object('average_percent',rate,'window_days',score_days,'threshold_percent',score_threshold)
    from x where rate<score_threshold
    on conflict(workspace_id,student_id,signal_type,evaluation_date) do update
      set severity=excluded.severity,risk_score=excluded.risk_score,reason=excluded.reason,evidence=excluded.evidence,status='open';
    get diagnostics n=row_count; affected:=affected+n;
  end if;

  if behavior_threshold is not null then
    with x as (
      select student_id,sum(abs(points))::int total from public.behavior_records
      where workspace_id=target_workspace_id and tone in('concern','discipline')
        and behavior_date>=current_date-(behavior_days-1) group by student_id
    )
    insert into public.early_warning_signals(workspace_id,student_id,signal_type,severity,risk_score,reason,evidence)
    select target_workspace_id,student_id,'negative_behavior',case when total>=behavior_threshold*2 then 'high' else 'medium' end,
      least(100,total*8),format('พฤติกรรมที่ต้องติดตาม %s คะแนนใน %s วัน (เกณฑ์ %s)',total,behavior_days,behavior_threshold),
      jsonb_build_object('negative_points',total,'window_days',behavior_days,'threshold',behavior_threshold)
    from x where total>=behavior_threshold
    on conflict(workspace_id,student_id,signal_type,evaluation_date) do update
      set severity=excluded.severity,risk_score=excluded.risk_score,reason=excluded.reason,evidence=excluded.evidence,status='open';
    get diagnostics n=row_count; affected:=affected+n;
  end if;

  if savings_threshold is not null then
    with x as (
      select student_id,max(amount) amount from public.savings_transactions
      where workspace_id=target_workspace_id and transaction_date>=current_date-(savings_days-1)
      group by student_id
    )
    insert into public.early_warning_signals(workspace_id,student_id,signal_type,severity,risk_score,reason,evidence)
    select target_workspace_id,student_id,'savings_anomaly','medium',least(100,(amount/savings_threshold)*50),
      format('พบรายการเงินออม %s บาท สูงกว่าเกณฑ์ %s บาท',amount,savings_threshold),
      jsonb_build_object('amount',amount,'threshold',savings_threshold,'window_days',savings_days)
    from x where amount>=savings_threshold
    on conflict(workspace_id,student_id,signal_type,evaluation_date) do update
      set risk_score=excluded.risk_score,reason=excluded.reason,evidence=excluded.evidence,status='open';
    get diagnostics n=row_count; affected:=affected+n;
  end if;

  if visit_deadline is not null and current_date >= visit_deadline then
    insert into public.early_warning_signals(workspace_id,student_id,signal_type,severity,risk_score,reason,evidence)
    select target_workspace_id,s.id,'home_visit_incomplete','medium',100-coalesce(v.completion_percent,0),
      format('แบบเยี่ยมบ้านครบ %s%% เมื่อถึงกำหนด %s',coalesce(v.completion_percent,0),visit_deadline),
      jsonb_build_object('completion_percent',coalesce(v.completion_percent,0),'deadline',visit_deadline)
    from public.students s left join lateral (
      select completion_percent from public.student_home_visits where workspace_id=target_workspace_id
      and student_id=s.id and status<>'archived' order by updated_at desc limit 1
    ) v on true where s.workspace_id=target_workspace_id and s.status='active' and coalesce(v.completion_percent,0)<100
    on conflict(workspace_id,student_id,signal_type,evaluation_date) do update
      set risk_score=excluded.risk_score,reason=excluded.reason,evidence=excluded.evidence,status='open';
    get diagnostics n=row_count; affected:=affected+n;
  end if;

  -- Open care cases only from the enabled absence rule.
  insert into public.student_care_cases(workspace_id,student_id,case_type,risk_level,status,summary,next_action,assigned_to,opened_by,metadata)
  select e.workspace_id,e.student_id,'attendance','watch','open',e.reason,'ครูตรวจสอบและติดต่อผู้ปกครอง',
    auth.uid(),auth.uid(),jsonb_build_object('source','automation','signal_id',e.id)
  from public.early_warning_signals e join public.automation_rules r
    on r.workspace_id=e.workspace_id and r.trigger_type=e.signal_type and r.action_type='open_care_case' and r.is_active
  where e.workspace_id=target_workspace_id and e.evaluation_date=current_date and e.status='open'
  on conflict do nothing;

  -- Today's absences become approval drafts, never automatic sends.
  if today_rule then
    insert into public.communication_approval_queue(
      workspace_id,student_id,recipient_profile_id,recipient_name,channels,title,body,reason,
      source_type,source_id,status,consent_snapshot,created_by
    )
    select target_workspace_id,s.id,g.profile_id,g.display_name,array['in_app']::text[],
      'แจ้งเวลาเรียน: '||s.first_name||' '||s.last_name,
      s.first_name||' '||s.last_name||' ขาดเรียนวันที่ '||current_date,
      'ระบบเตรียมจากผลเช็กชื่อวันนี้ รอครูอนุมัติก่อนส่ง','attendance_session',a.session_id,'pending',
      jsonb_build_object('consent_status',g.consent_status,'relation',g.relation),auth.uid()
    from public.attendance_records a join public.attendance_sessions ats on ats.id=a.session_id
    join public.students s on s.id=a.student_id
    join public.student_guardians g on g.student_id=s.id and g.workspace_id=target_workspace_id
    where a.workspace_id=target_workspace_id and a.status='absent' and ats.attendance_date=current_date
      and g.consent_status='granted'
    on conflict do nothing;
  end if;

  select count(*) into evaluated from public.students where workspace_id=target_workspace_id and status='active';
  update public.automation_runs set status='completed',evaluated_count=evaluated,created_count=affected,
    result=jsonb_build_object('signals',affected),finished_at=now() where id=run_id;
  return jsonb_build_object('run_id',run_id,'evaluated',evaluated,'signals',affected);
exception when others then
  if run_id is not null then update public.automation_runs set status='failed',
    result=jsonb_build_object('error',sqlerrm),finished_at=now() where id=run_id; end if;
  raise;
end $$;
