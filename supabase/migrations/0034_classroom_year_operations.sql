-- ClassCare 360 - classroom duty, period locks, year closure/archive and secure parent invitations.

create table if not exists public.duty_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  name text not null,
  slots_per_day integer not null default 1 check (slots_per_day between 1 and 10),
  positive_points integer not null default 1 check (positive_points between 0 and 20),
  missed_points integer not null default -1 check (missed_points between -20 and 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, name)
);

create table if not exists public.duty_weeks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  strategy text not null default 'balanced' check (strategy in ('balanced','random','manual')),
  generated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, week_start)
);

create table if not exists public.duty_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  duty_week_id uuid not null references public.duty_weeks(id) on delete cascade,
  duty_task_id uuid not null references public.duty_tasks(id) on delete cascade,
  duty_date date not null,
  student_id uuid not null references public.students(id) on delete cascade,
  slot_number integer not null default 1,
  status text not null default 'assigned' check (status in ('assigned','completed','missed','excused','substituted')),
  substitute_student_id uuid references public.students(id) on delete set null,
  note text,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  behavior_record_id uuid references public.behavior_records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (duty_week_id, duty_task_id, duty_date, slot_number)
);

create table if not exists public.data_period_locks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete cascade,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  module_key text not null check (module_key in ('attendance','scores','savings')),
  status text not null default 'locked' check (status in ('locked','unlocked')),
  reason text not null,
  locked_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz not null default now(),
  unlocked_by uuid references public.profiles(id) on delete set null,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, period_month, module_key)
);

create table if not exists public.data_unlock_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lock_id uuid not null references public.data_period_locks(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_year_closures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_classroom_id uuid not null references public.classrooms(id) on delete restrict,
  source_academic_year text not null,
  target_classroom_id uuid references public.classrooms(id) on delete restrict,
  target_academic_year text not null,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','executed','undone','cancelled')),
  note text,
  prepared_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  executed_by uuid references public.profiles(id) on delete set null,
  executed_at timestamptz,
  undone_by uuid references public.profiles(id) on delete set null,
  undone_at timestamptz,
  undo_deadline timestamptz,
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_year_transitions (
  id uuid primary key default gen_random_uuid(),
  closure_id uuid not null references public.academic_year_closures(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  from_classroom_id uuid references public.classrooms(id) on delete set null,
  to_classroom_id uuid references public.classrooms(id) on delete set null,
  transition_type text not null default 'promoted' check (transition_type in ('promoted','retained','graduated','transferred','inactive')),
  previous_status text not null,
  target_status text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (closure_id, student_id)
);

create table if not exists public.academic_year_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  closure_id uuid references public.academic_year_closures(id) on delete set null,
  academic_year text not null,
  classroom_id uuid references public.classrooms(id) on delete set null,
  classroom_name text not null,
  snapshot_type text not null default 'year_close' check (snapshot_type in ('manual','year_close','pre_undo')),
  record_counts jsonb not null default '{}',
  snapshot_data jsonb not null default '{}',
  checksum text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists duty_assignments_student_date_idx on public.duty_assignments(workspace_id,student_id,duty_date desc);
create index if not exists period_locks_lookup_idx on public.data_period_locks(workspace_id,classroom_id,period_month,module_key,status);
create index if not exists closures_workspace_idx on public.academic_year_closures(workspace_id,created_at desc);
create index if not exists snapshots_workspace_idx on public.academic_year_snapshots(workspace_id,academic_year,created_at desc);

do $$ declare t text; begin
  foreach t in array array['duty_tasks','duty_weeks','duty_assignments','data_period_locks','data_unlock_requests','academic_year_closures','student_year_transitions','academic_year_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_workspace_access', t);
    execute format('drop policy if exists %I on public.%I', t || '_workspace_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_workspace_manage', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_superadmin() or public.has_workspace_role(workspace_id,array[''teacher_owner'',''teacher_member'']))', t || '_workspace_select', t);
  end loop;
  foreach t in array array['duty_tasks','duty_weeks','duty_assignments'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_superadmin() or public.has_workspace_role(workspace_id,array[''teacher_owner'',''teacher_member''])) with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array[''teacher_owner'',''teacher_member'']))', t || '_workspace_manage', t);
  end loop;
  foreach t in array array['data_period_locks','academic_year_closures','student_year_transitions','academic_year_snapshots'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_superadmin() or public.has_workspace_role(workspace_id,array[''teacher_owner''])) with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array[''teacher_owner'']))', t || '_workspace_manage', t);
  end loop;
end $$;

create policy data_unlock_requests_insert_member
on public.data_unlock_requests for insert to authenticated
with check (
  requested_by = auth.uid()
  and (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']))
);

create policy data_unlock_requests_manage_owner
on public.data_unlock_requests for update to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner']));

do $$ declare t text; begin
  foreach t in array array['duty_tasks','duty_weeks','duty_assignments','data_period_locks','data_unlock_requests','academic_year_closures'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch_updated_at', t);
  end loop;
end $$;

create or replace function public.seed_default_duty_tasks(target_workspace_id uuid,target_classroom_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner','teacher_member'])) then raise exception 'not_allowed'; end if;
  insert into public.duty_tasks(workspace_id,classroom_id,name,sort_order,created_by)
  values (target_workspace_id,target_classroom_id,'กวาดพื้น',10,auth.uid()),(target_workspace_id,target_classroom_id,'ทิ้งขยะ',20,auth.uid()),(target_workspace_id,target_classroom_id,'ลบกระดาน',30,auth.uid()),(target_workspace_id,target_classroom_id,'จัดโต๊ะเก้าอี้',40,auth.uid()),(target_workspace_id,target_classroom_id,'รดน้ำต้นไม้',50,auth.uid())
  on conflict(workspace_id,classroom_id,name) do nothing;
  get diagnostics n=row_count; return n;
end $$;

create or replace function public.generate_balanced_duty_week(target_workspace_id uuid,target_classroom_id uuid,target_week_start date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare week_id uuid; task_row record; day_offset integer; slot_no integer; picked uuid;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner','teacher_member'])) then raise exception 'not_allowed'; end if;
  if extract(isodow from target_week_start)<>1 then raise exception 'week_start_must_be_monday'; end if;
  perform public.seed_default_duty_tasks(target_workspace_id,target_classroom_id);
  insert into public.duty_weeks(workspace_id,classroom_id,week_start,generated_by)
  values(target_workspace_id,target_classroom_id,target_week_start,auth.uid())
  on conflict(workspace_id,classroom_id,week_start) do update set strategy='balanced',generated_by=auth.uid(),updated_at=now()
  returning id into week_id;
  delete from public.duty_assignments where duty_week_id=week_id and status='assigned';
  for day_offset in 0..4 loop
    for task_row in select * from public.duty_tasks where workspace_id=target_workspace_id and classroom_id=target_classroom_id and is_active order by sort_order,name loop
      for slot_no in 1..task_row.slots_per_day loop
        select s.id into picked from public.students s
        where s.workspace_id=target_workspace_id and s.classroom_id=target_classroom_id and s.status='active'
          and not exists(select 1 from public.duty_assignments da where da.duty_week_id=week_id and da.duty_date=target_week_start+day_offset and da.student_id=s.id)
        order by (select count(*) from public.duty_assignments h where h.workspace_id=target_workspace_id and h.student_id=s.id and h.duty_date>=target_week_start-28),random() limit 1;
        if picked is not null then insert into public.duty_assignments(workspace_id,duty_week_id,duty_task_id,duty_date,student_id,slot_number) values(target_workspace_id,week_id,task_row.id,target_week_start+day_offset,picked,slot_no); end if;
      end loop;
    end loop;
  end loop;
  update public.duty_weeks set status='published',published_at=now() where id=week_id;
  return week_id;
end $$;

create or replace function public.record_duty_result(target_assignment_id uuid,next_status text,target_substitute_student_id uuid default null,result_note text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare a public.duty_assignments%rowtype; task public.duty_tasks%rowtype; behavior_id uuid; point_value integer; actual_student uuid;
begin
  if next_status not in ('completed','missed','excused','substituted') then raise exception 'invalid_status'; end if;
  select * into a from public.duty_assignments where id=target_assignment_id;
  if a.id is null then raise exception 'assignment_not_found'; end if;
  if not (public.is_superadmin() or public.has_workspace_role(a.workspace_id,array['teacher_owner','teacher_member'])) then raise exception 'not_allowed'; end if;
  select * into task from public.duty_tasks where id=a.duty_task_id;
  actual_student:=case when next_status='substituted' then target_substitute_student_id else a.student_id end;
  point_value:=case when next_status in ('completed','substituted') then task.positive_points when next_status='missed' then task.missed_points else 0 end;
  if a.behavior_record_id is not null then delete from public.behavior_records where id=a.behavior_record_id; end if;
  if point_value<>0 and actual_student is not null then
    insert into public.behavior_records(workspace_id,student_id,tone,category,description,points,behavior_date,recorded_by,metadata)
    values(a.workspace_id,actual_student,case when point_value>0 then 'positive' else 'discipline' end,'งานเวรประจำชั้น',task.name||' · '||case when next_status='missed' then 'ไม่ได้ปฏิบัติงาน' else 'ปฏิบัติงานเรียบร้อย' end,point_value,a.duty_date,auth.uid(),jsonb_build_object('source','duty_assignment','assignment_id',a.id,'original_student_id',a.student_id)) returning id into behavior_id;
  end if;
  update public.duty_assignments set status=next_status,substitute_student_id=target_substitute_student_id,note=result_note,checked_by=auth.uid(),checked_at=now(),behavior_record_id=behavior_id where id=a.id;
  return jsonb_build_object('updated',true,'behavior_points',point_value,'behavior_record_id',behavior_id);
end $$;

create or replace function public.set_period_lock(target_workspace_id uuid,target_classroom_id uuid,target_month date,target_module text,lock_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare lock_id uuid;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  if target_module not in ('attendance','scores','savings') then raise exception 'invalid_module'; end if;
  insert into public.data_period_locks(workspace_id,classroom_id,period_month,module_key,status,reason,locked_by,locked_at,unlocked_by,unlocked_at)
  values(target_workspace_id,target_classroom_id,date_trunc('month',target_month)::date,target_module,'locked',lock_reason,auth.uid(),now(),null,null)
  on conflict(workspace_id,classroom_id,period_month,module_key) do update set status='locked',reason=excluded.reason,locked_by=auth.uid(),locked_at=now(),unlocked_by=null,unlocked_at=null,updated_at=now() returning id into lock_id;
  return lock_id;
end $$;

create or replace function public.request_period_unlock(target_lock_id uuid,request_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare l public.data_period_locks%rowtype; request_id uuid;
begin
  select * into l from public.data_period_locks where id=target_lock_id;
  if l.id is null or not (public.is_superadmin() or public.has_workspace_role(l.workspace_id,array['teacher_owner','teacher_member'])) then raise exception 'not_allowed'; end if;
  insert into public.data_unlock_requests(workspace_id,lock_id,requested_by,reason) values(l.workspace_id,l.id,auth.uid(),request_reason) returning id into request_id; return request_id;
end $$;

create or replace function public.review_period_unlock(target_request_id uuid,approve boolean,target_review_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.data_unlock_requests%rowtype;
begin
  select * into r from public.data_unlock_requests where id=target_request_id;
  if r.id is null or not (public.is_superadmin() or public.has_workspace_role(r.workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  update public.data_unlock_requests set status=case when approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_note=target_review_note where id=r.id and status='pending';
  if approve then update public.data_period_locks set status='unlocked',unlocked_by=auth.uid(),unlocked_at=now() where id=r.lock_id; end if;
  return jsonb_build_object('reviewed',true,'approved',approve);
end $$;

create or replace function public.prepare_year_closure(target_workspace_id uuid,source_classroom uuid,target_classroom uuid,target_year text,closure_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_closure_id uuid; source_year text;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  select academic_year into source_year from public.classrooms where id=source_classroom and workspace_id=target_workspace_id;
  if source_year is null then raise exception 'source_classroom_not_found'; end if;
  insert into public.academic_year_closures(workspace_id,source_classroom_id,source_academic_year,target_classroom_id,target_academic_year,status,note,prepared_by)
  values(target_workspace_id,source_classroom,source_year,target_classroom,target_year,'pending_approval',closure_note,auth.uid()) returning id into new_closure_id;
  insert into public.student_year_transitions(closure_id,workspace_id,student_id,from_classroom_id,to_classroom_id,transition_type,previous_status,target_status)
  select new_closure_id,target_workspace_id,id,classroom_id,target_classroom,'promoted',status,'active' from public.students where workspace_id=target_workspace_id and classroom_id=source_classroom and status='active';
  update public.academic_year_closures set summary=jsonb_build_object('total_students',(select count(*) from public.student_year_transitions where closure_id=new_closure_id),'promoted',(select count(*) from public.student_year_transitions where closure_id=new_closure_id and transition_type='promoted')) where id=new_closure_id;
  return new_closure_id;
end $$;

create or replace function public.set_year_transition(target_transition_id uuid,next_type text,next_classroom_id uuid default null,transition_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.student_year_transitions%rowtype; c public.academic_year_closures%rowtype; next_status text;
begin
  if next_type not in ('promoted','retained','graduated','transferred','inactive') then raise exception 'invalid_transition_type'; end if;
  select * into t from public.student_year_transitions where id=target_transition_id;
  select * into c from public.academic_year_closures where id=t.closure_id;
  if t.id is null or c.status not in ('draft','pending_approval') then raise exception 'transition_not_editable'; end if;
  if not (public.is_superadmin() or public.has_workspace_role(t.workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  next_status := case when next_type in ('graduated','transferred','inactive') then 'inactive' else 'active' end;
  update public.student_year_transitions
  set transition_type=next_type,
      to_classroom_id=case when next_type='retained' then from_classroom_id when next_type in ('graduated','inactive') then null else coalesce(next_classroom_id,c.target_classroom_id) end,
      target_status=next_status,
      note=transition_note
  where id=t.id;
  update public.academic_year_closures
  set summary=(select jsonb_build_object('total_students',count(*),'promoted',count(*) filter(where transition_type='promoted'),'retained',count(*) filter(where transition_type='retained'),'graduated',count(*) filter(where transition_type='graduated'),'transferred',count(*) filter(where transition_type='transferred'),'inactive',count(*) filter(where transition_type='inactive')) from public.student_year_transitions where closure_id=c.id)
  where id=c.id;
  return jsonb_build_object('updated',true,'transition_type',next_type);
end $$;

create or replace function public.approve_year_closure(target_closure_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.academic_year_closures%rowtype;
begin
  select * into c from public.academic_year_closures where id=target_closure_id;
  if c.id is null or not (public.is_superadmin() or public.has_workspace_role(c.workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  update public.academic_year_closures set status='approved',approved_by=auth.uid(),approved_at=now() where id=c.id and status='pending_approval';
  return jsonb_build_object('approved',true);
end $$;

create or replace function public.execute_year_closure(target_closure_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.academic_year_closures%rowtype; snapshot_id uuid;
begin
  select * into c from public.academic_year_closures where id=target_closure_id for update;
  if c.id is null or c.status<>'approved' then raise exception 'closure_not_approved'; end if;
  if not (public.is_superadmin() or public.has_workspace_role(c.workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  insert into public.academic_year_snapshots(workspace_id,closure_id,academic_year,classroom_id,classroom_name,record_counts,snapshot_data,created_by)
  select c.workspace_id,c.id,c.source_academic_year,c.source_classroom_id,cl.name,
    jsonb_build_object('students',(select count(*) from public.student_year_transitions where closure_id=c.id)),
    jsonb_build_object('students',(select jsonb_agg(to_jsonb(s)) from public.students s where s.workspace_id=c.workspace_id and s.classroom_id=c.source_classroom_id),'transitions',(select jsonb_agg(to_jsonb(t)) from public.student_year_transitions t where t.closure_id=c.id)),auth.uid()
  from public.classrooms cl where cl.id=c.source_classroom_id returning id into snapshot_id;
  update public.students s set classroom_id=t.to_classroom_id,status=t.target_status,updated_at=now() from public.student_year_transitions t where t.closure_id=c.id and t.student_id=s.id;
  update public.classrooms set status='archived' where id=c.source_classroom_id;
  update public.academic_year_closures set status='executed',executed_by=auth.uid(),executed_at=now(),undo_deadline=now()+interval '7 days' where id=c.id;
  return jsonb_build_object('executed',true,'snapshot_id',snapshot_id,'undo_until',now()+interval '7 days');
end $$;

create or replace function public.undo_year_closure(target_closure_id uuid,undo_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.academic_year_closures%rowtype;
begin
  select * into c from public.academic_year_closures where id=target_closure_id for update;
  if c.id is null or c.status<>'executed' or now()>c.undo_deadline then raise exception 'undo_not_available'; end if;
  if not (public.is_superadmin() or public.has_workspace_role(c.workspace_id,array['teacher_owner'])) then raise exception 'owner_required'; end if;
  update public.students s set classroom_id=t.from_classroom_id,status=t.previous_status,updated_at=now() from public.student_year_transitions t where t.closure_id=c.id and t.student_id=s.id;
  update public.classrooms set status='active' where id=c.source_classroom_id;
  update public.academic_year_closures set status='undone',undone_by=auth.uid(),undone_at=now(),summary=summary||jsonb_build_object('undo_reason',undo_reason) where id=c.id;
  return jsonb_build_object('undone',true);
end $$;

create or replace function public.assert_period_is_writable(target_workspace_id uuid,target_classroom_id uuid,target_date date,target_module text)
returns void language plpgsql stable security definer set search_path=public as $$
begin
  if exists (
    select 1 from public.data_period_locks l
    where l.workspace_id=target_workspace_id
      and l.module_key=target_module
      and l.status='locked'
      and l.period_month=date_trunc('month',target_date)::date
      and (l.classroom_id is null or l.classroom_id=target_classroom_id)
  ) then
    raise exception using errcode='P0001',message='period_locked',detail=target_module||':'||to_char(target_date,'YYYY-MM');
  end if;
end $$;

create or replace function public.enforce_attendance_period_lock()
returns trigger language plpgsql security definer set search_path=public as $$
declare s public.attendance_sessions%rowtype;
begin
  if TG_TABLE_NAME='attendance_sessions' then
    s:=case when TG_OP='DELETE' then OLD else NEW end;
  else
    select ats.* into s from public.attendance_sessions ats where ats.id=case when TG_OP='DELETE' then OLD.session_id else NEW.session_id end;
  end if;
  perform public.assert_period_is_writable(s.workspace_id,s.classroom_id,s.attendance_date,'attendance');
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

create or replace function public.enforce_score_period_lock()
returns trigger language plpgsql security definer set search_path=public as $$
declare a public.score_assessments%rowtype;
begin
  if TG_TABLE_NAME='score_assessments' then
    a:=case when TG_OP='DELETE' then OLD else NEW end;
  else
    select sa.* into a from public.score_assessments sa where sa.id=case when TG_OP='DELETE' then OLD.assessment_id else NEW.assessment_id end;
  end if;
  perform public.assert_period_is_writable(a.workspace_id,a.classroom_id,a.assessment_date,'scores');
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

create or replace function public.enforce_savings_period_lock()
returns trigger language plpgsql security definer set search_path=public as $$
declare tx public.savings_transactions%rowtype; room_id uuid;
begin
  tx:=case when TG_OP='DELETE' then OLD else NEW end;
  select classroom_id into room_id from public.students where id=tx.student_id and workspace_id=tx.workspace_id;
  perform public.assert_period_is_writable(tx.workspace_id,room_id,tx.transaction_date,'savings');
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

drop trigger if exists attendance_sessions_period_lock on public.attendance_sessions;
create trigger attendance_sessions_period_lock before insert or update or delete on public.attendance_sessions for each row execute function public.enforce_attendance_period_lock();
drop trigger if exists attendance_records_period_lock on public.attendance_records;
create trigger attendance_records_period_lock before insert or update or delete on public.attendance_records for each row execute function public.enforce_attendance_period_lock();
drop trigger if exists score_assessments_period_lock on public.score_assessments;
create trigger score_assessments_period_lock before insert or update or delete on public.score_assessments for each row execute function public.enforce_score_period_lock();
drop trigger if exists score_entries_period_lock on public.score_entries;
create trigger score_entries_period_lock before insert or update or delete on public.score_entries for each row execute function public.enforce_score_period_lock();
drop trigger if exists savings_transactions_period_lock on public.savings_transactions;
create trigger savings_transactions_period_lock before insert or update or delete on public.savings_transactions for each row execute function public.enforce_savings_period_lock();

revoke all on function public.seed_default_duty_tasks(uuid,uuid) from public;
revoke all on function public.generate_balanced_duty_week(uuid,uuid,date) from public;
revoke all on function public.record_duty_result(uuid,text,uuid,text) from public;
revoke all on function public.set_period_lock(uuid,uuid,date,text,text) from public;
revoke all on function public.request_period_unlock(uuid,text) from public;
revoke all on function public.review_period_unlock(uuid,boolean,text) from public;
revoke all on function public.prepare_year_closure(uuid,uuid,uuid,text,text) from public;
revoke all on function public.approve_year_closure(uuid) from public;
revoke all on function public.execute_year_closure(uuid) from public;
revoke all on function public.undo_year_closure(uuid,text) from public;
revoke all on function public.set_year_transition(uuid,text,uuid,text) from public;
grant execute on function public.seed_default_duty_tasks(uuid,uuid) to authenticated;
grant execute on function public.generate_balanced_duty_week(uuid,uuid,date) to authenticated;
grant execute on function public.record_duty_result(uuid,text,uuid,text) to authenticated;
grant execute on function public.set_period_lock(uuid,uuid,date,text,text) to authenticated;
grant execute on function public.request_period_unlock(uuid,text) to authenticated;
grant execute on function public.review_period_unlock(uuid,boolean,text) to authenticated;
grant execute on function public.prepare_year_closure(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.approve_year_closure(uuid) to authenticated;
grant execute on function public.execute_year_closure(uuid) to authenticated;
grant execute on function public.undo_year_closure(uuid,text) to authenticated;
grant execute on function public.set_year_transition(uuid,text,uuid,text) to authenticated;

notify pgrst,'reload schema';
