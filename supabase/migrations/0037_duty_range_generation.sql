-- Generate duty assignments atomically for a day, month, term, or custom date range.

create or replace function public.generate_balanced_duty_range(
  target_workspace_id uuid,
  target_classroom_id uuid,
  target_start_date date,
  target_end_date date,
  target_scope text default 'custom'
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  target_date date;
  target_week date;
  week_id uuid;
  task_row record;
  slot_no integer;
  picked uuid;
  generated_count integer := 0;
  school_day_count integer := 0;
  week_count integer := 0;
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id,array['teacher_owner','teacher_member'])) then
    raise exception 'not_allowed';
  end if;
  if target_scope not in ('day','month','term','custom') then
    raise exception 'invalid_scope';
  end if;
  if target_start_date is null or target_end_date is null or target_end_date < target_start_date then
    raise exception 'invalid_date_range';
  end if;
  if target_end_date - target_start_date > 200 then
    raise exception 'date_range_too_large';
  end if;
  if not exists (
    select 1 from public.classrooms
    where id=target_classroom_id and workspace_id=target_workspace_id
  ) then
    raise exception 'classroom_not_found';
  end if;

  perform public.seed_default_duty_tasks(target_workspace_id,target_classroom_id);

  -- Keep checked results. Only replace assignments that have not been checked yet.
  delete from public.duty_assignments
  where workspace_id=target_workspace_id
    and duty_date between target_start_date and target_end_date
    and status='assigned'
    and duty_week_id in (
      select id from public.duty_weeks
      where workspace_id=target_workspace_id and classroom_id=target_classroom_id
    );

  for target_date in select generate_series(target_start_date,target_end_date,'1 day'::interval)::date loop
    -- Closed/holiday dates in the school calendar never receive duty assignments.
    if exists (
      select 1 from public.school_calendar_days
      where workspace_id=target_workspace_id
        and calendar_date=target_date
        and day_type in ('holiday','closed')
    ) then
      continue;
    end if;
    if not exists (
      select 1 from public.duty_tasks
      where workspace_id=target_workspace_id
        and classroom_id=target_classroom_id
        and is_active
        and rotation_strategy<>'manual'
        and extract(isodow from target_date)::integer=any(active_weekdays)
    ) then
      continue;
    end if;

    target_week := target_date-(extract(isodow from target_date)::integer-1);
    insert into public.duty_weeks(workspace_id,classroom_id,week_start,strategy,status,generated_by,published_at,metadata)
    values(
      target_workspace_id,target_classroom_id,target_week,'balanced','published',auth.uid(),now(),
      jsonb_build_object('generation_scope',target_scope,'range_start',target_start_date,'range_end',target_end_date)
    )
    on conflict(workspace_id,classroom_id,week_start) do update
      set strategy='balanced',status='published',generated_by=auth.uid(),published_at=now(),updated_at=now(),
          metadata=public.duty_weeks.metadata||excluded.metadata
    returning id into week_id;

    school_day_count := school_day_count + 1;

    for task_row in
      select * from public.duty_tasks
      where workspace_id=target_workspace_id
        and classroom_id=target_classroom_id
        and is_active
        and extract(isodow from target_date)::integer=any(active_weekdays)
      order by sort_order,name
    loop
      if task_row.rotation_strategy='manual' then continue; end if;

      for slot_no in 1..task_row.slots_per_day loop
        -- A checked result owns its slot and must never be replaced.
        if exists (
          select 1 from public.duty_assignments existing_assignment
          where existing_assignment.duty_week_id=week_id
            and existing_assignment.duty_task_id=task_row.id
            and existing_assignment.duty_date=target_date
            and existing_assignment.slot_number=slot_no
        ) then
          continue;
        end if;
        picked := null;
        if task_row.rotation_strategy='fixed' then
          select da.student_id into picked
          from public.duty_assignments da
          join public.students s on s.id=da.student_id
            and s.status='active' and s.classroom_id=target_classroom_id
          where da.workspace_id=target_workspace_id
            and da.duty_task_id=task_row.id
            and da.duty_date=target_date-7
            and da.slot_number=slot_no
            and not exists (
              select 1 from public.duty_assignments current_da
              where current_da.workspace_id=target_workspace_id
                and current_da.duty_date=target_date
                and current_da.student_id=da.student_id
            )
          limit 1;
        end if;

        if picked is null then
          select s.id into picked
          from public.students s
          where s.workspace_id=target_workspace_id
            and s.classroom_id=target_classroom_id
            and s.status='active'
            and not exists (
              select 1 from public.duty_assignments da
              where da.workspace_id=target_workspace_id
                and da.duty_date=target_date
                and da.student_id=s.id
            )
          order by
            case when task_row.rotation_strategy='random' then random() else 0 end,
            (select count(*) from public.duty_assignments h
              where h.workspace_id=target_workspace_id
                and h.student_id=s.id
                and h.duty_date between target_start_date-35 and target_end_date),
            random()
          limit 1;
        end if;

        if picked is not null then
          insert into public.duty_assignments(workspace_id,duty_week_id,duty_task_id,duty_date,student_id,slot_number)
          values(target_workspace_id,week_id,task_row.id,target_date,picked,slot_no);
          generated_count := generated_count + 1;
        end if;
      end loop;
    end loop;
  end loop;

  select count(distinct week_start) into week_count
  from public.duty_weeks
  where workspace_id=target_workspace_id and classroom_id=target_classroom_id
    and week_start between target_start_date-6 and target_end_date;

  return jsonb_build_object(
    'scope',target_scope,
    'start_date',target_start_date,
    'end_date',target_end_date,
    'school_days',school_day_count,
    'weeks',week_count,
    'assignments',generated_count
  );
end $$;

revoke all on function public.generate_balanced_duty_range(uuid,uuid,date,date,text) from public;
grant execute on function public.generate_balanced_duty_range(uuid,uuid,date,date,text) to authenticated;

notify pgrst,'reload schema';
