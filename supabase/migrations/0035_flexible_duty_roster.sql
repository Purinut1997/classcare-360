-- Flexible school duty roster: each duty can run on different weekdays with its own staffing and verification rules.

alter table public.duty_tasks
  add column if not exists location text,
  add column if not exists instructions text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists active_weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  add column if not exists rotation_strategy text not null default 'balanced',
  add column if not exists allow_substitute boolean not null default true,
  add column if not exists evidence_required boolean not null default false;

alter table public.duty_tasks drop constraint if exists duty_tasks_rotation_strategy_check;
alter table public.duty_tasks add constraint duty_tasks_rotation_strategy_check
  check (rotation_strategy in ('balanced','random','fixed','manual'));
alter table public.duty_tasks drop constraint if exists duty_tasks_active_weekdays_check;
alter table public.duty_tasks add constraint duty_tasks_active_weekdays_check
  check (active_weekdays <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(active_weekdays) > 0);

alter table public.duty_assignments
  add column if not exists checklist_result jsonb not null default '[]'::jsonb,
  add column if not exists evidence_paths text[] not null default '{}'::text[];

create index if not exists duty_tasks_schedule_idx
on public.duty_tasks (workspace_id,classroom_id,is_active,sort_order);

create or replace function public.generate_balanced_duty_week(target_workspace_id uuid,target_classroom_id uuid,target_week_start date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare week_id uuid; task_row record; day_offset integer; slot_no integer; picked uuid; iso_day integer;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner','teacher_member'])) then raise exception 'not_allowed'; end if;
  if extract(isodow from target_week_start)<>1 then raise exception 'week_start_must_be_monday'; end if;
  perform public.seed_default_duty_tasks(target_workspace_id,target_classroom_id);
  insert into public.duty_weeks(workspace_id,classroom_id,week_start,generated_by)
  values(target_workspace_id,target_classroom_id,target_week_start,auth.uid())
  on conflict(workspace_id,classroom_id,week_start) do update set strategy='balanced',generated_by=auth.uid(),updated_at=now()
  returning id into week_id;
  delete from public.duty_assignments where duty_week_id=week_id and status='assigned';
  for day_offset in 0..6 loop
    iso_day:=day_offset+1;
    for task_row in
      select * from public.duty_tasks
      where workspace_id=target_workspace_id and classroom_id=target_classroom_id and is_active and iso_day=any(active_weekdays)
      order by sort_order,name
    loop
      if task_row.rotation_strategy='manual' then
        continue;
      end if;
      for slot_no in 1..task_row.slots_per_day loop
        picked:=null;
        if task_row.rotation_strategy='fixed' then
          select da.student_id into picked
          from public.duty_assignments da
          join public.students s on s.id=da.student_id and s.status='active' and s.classroom_id=target_classroom_id
          where da.workspace_id=target_workspace_id
            and da.duty_task_id=task_row.id
            and da.duty_date=target_week_start+day_offset-7
            and da.slot_number=slot_no
            and not exists(select 1 from public.duty_assignments current_da where current_da.duty_week_id=week_id and current_da.duty_date=target_week_start+day_offset and current_da.student_id=da.student_id)
          limit 1;
        end if;
        if picked is null then
          select s.id into picked from public.students s
          where s.workspace_id=target_workspace_id and s.classroom_id=target_classroom_id and s.status='active'
            and not exists(select 1 from public.duty_assignments da where da.duty_week_id=week_id and da.duty_date=target_week_start+day_offset and da.student_id=s.id)
          order by
            case when task_row.rotation_strategy='random' then random() else 0 end,
            (select count(*) from public.duty_assignments h where h.workspace_id=target_workspace_id and h.student_id=s.id and h.duty_date>=target_week_start-28),
            random()
          limit 1;
        end if;
        if picked is not null then
          insert into public.duty_assignments(workspace_id,duty_week_id,duty_task_id,duty_date,student_id,slot_number)
          values(target_workspace_id,week_id,task_row.id,target_week_start+day_offset,picked,slot_no);
        end if;
      end loop;
    end loop;
  end loop;
  update public.duty_weeks set status='published',published_at=now(),metadata=metadata||jsonb_build_object('schedule_days',7) where id=week_id;
  return week_id;
end $$;

create or replace function public.record_duty_result_v2(
  target_assignment_id uuid,
  next_status text,
  target_substitute_student_id uuid default null,
  result_note text default null,
  target_checklist_result jsonb default '[]'::jsonb,
  target_evidence_paths text[] default '{}'::text[]
)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
  result:=public.record_duty_result(target_assignment_id,next_status,target_substitute_student_id,result_note);
  update public.duty_assignments
  set checklist_result=coalesce(target_checklist_result,'[]'::jsonb),evidence_paths=coalesce(target_evidence_paths,'{}'::text[])
  where id=target_assignment_id;
  return result||jsonb_build_object('checklist_saved',true,'evidence_count',cardinality(coalesce(target_evidence_paths,'{}'::text[])));
end $$;

create or replace function public.set_manual_duty_assignment(
  target_workspace_id uuid,
  target_classroom_id uuid,
  target_task_id uuid,
  target_date date,
  target_student_id uuid
)
returns uuid language plpgsql security invoker set search_path=public as $$
declare target_week date; week_id uuid; assignment_id uuid; next_slot integer;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner','teacher_member'])) then raise exception 'not_allowed'; end if;
  if not exists(select 1 from public.students where id=target_student_id and workspace_id=target_workspace_id and classroom_id=target_classroom_id and status='active') then raise exception 'student_not_in_classroom'; end if;
  if not exists(select 1 from public.duty_tasks where id=target_task_id and workspace_id=target_workspace_id and classroom_id=target_classroom_id and extract(isodow from target_date)::integer=any(active_weekdays)) then raise exception 'task_not_scheduled_for_day'; end if;
  target_week:=target_date-(extract(isodow from target_date)::integer-1);
  insert into public.duty_weeks(workspace_id,classroom_id,week_start,strategy,generated_by)
  values(target_workspace_id,target_classroom_id,target_week,'manual',auth.uid())
  on conflict(workspace_id,classroom_id,week_start) do update set updated_at=now()
  returning id into week_id;
  if exists(select 1 from public.duty_assignments where duty_week_id=week_id and duty_date=target_date and student_id=target_student_id) then raise exception 'student_already_assigned_today'; end if;
  select coalesce(max(slot_number),0)+1 into next_slot from public.duty_assignments where duty_week_id=week_id and duty_task_id=target_task_id and duty_date=target_date;
  insert into public.duty_assignments(workspace_id,duty_week_id,duty_task_id,duty_date,student_id,slot_number)
  values(target_workspace_id,week_id,target_task_id,target_date,target_student_id,next_slot)
  returning id into assignment_id;
  return assignment_id;
end $$;

revoke all on function public.record_duty_result_v2(uuid,text,uuid,text,jsonb,text[]) from public;
grant execute on function public.record_duty_result_v2(uuid,text,uuid,text,jsonb,text[]) to authenticated;
revoke all on function public.set_manual_duty_assignment(uuid,uuid,uuid,date,uuid) from public;
grant execute on function public.set_manual_duty_assignment(uuid,uuid,uuid,date,uuid) to authenticated;

notify pgrst,'reload schema';
