-- Keep teacher-managed duty tasks durable and ensure every configured slot is filled
-- when the classroom has at least one active student.

do $$
declare
  function_oid regprocedure;
  original_definition text;
  updated_definition text;
  seed_call text := '  perform public.seed_default_duty_tasks(target_workspace_id,target_classroom_id);' || chr(10);
  assignment_marker text :=
    '        if picked is not null then' || chr(10) ||
    '          insert into public.duty_assignments(workspace_id,duty_week_id,duty_task_id,duty_date,student_id,slot_number)';
  assignment_replacement text :=
    '        -- Give everyone one duty first. If tasks outnumber students, reuse the' || chr(10) ||
    '        -- least-loaded student so no configured duty slot is left empty.' || chr(10) ||
    '        if picked is null then' || chr(10) ||
    '          select s.id into picked' || chr(10) ||
    '          from public.students s' || chr(10) ||
    '          where s.workspace_id=target_workspace_id' || chr(10) ||
    '            and s.classroom_id=target_classroom_id' || chr(10) ||
    '            and s.status=''active''' || chr(10) ||
    '          order by' || chr(10) ||
    '            (select count(*) from public.duty_assignments same_day' || chr(10) ||
    '              where same_day.workspace_id=target_workspace_id' || chr(10) ||
    '                and same_day.duty_date=target_date' || chr(10) ||
    '                and same_day.student_id=s.id),' || chr(10) ||
    '            (select count(*) from public.duty_assignments history' || chr(10) ||
    '              where history.workspace_id=target_workspace_id' || chr(10) ||
    '                and history.student_id=s.id' || chr(10) ||
    '                and history.duty_date between target_start_date-35 and target_end_date),' || chr(10) ||
    '            random()' || chr(10) ||
    '          limit 1;' || chr(10) ||
    '        end if;' || chr(10) || chr(10) ||
    '        if picked is not null then' || chr(10) ||
    '          insert into public.duty_assignments(workspace_id,duty_week_id,duty_task_id,duty_date,student_id,slot_number)';
begin
  -- Generation must never recreate templates that a teacher deliberately deleted.
  foreach function_oid in array array[
    'public.generate_balanced_duty_week(uuid,uuid,date)'::regprocedure,
    'public.generate_balanced_duty_range(uuid,uuid,date,date,text)'::regprocedure
  ] loop
    select pg_get_functiondef(function_oid) into original_definition;
    updated_definition := replace(original_definition,seed_call,'');
    if updated_definition = original_definition then
      raise exception 'Could not remove automatic duty seeding from %',function_oid;
    end if;

    -- The range generator is the current UI path. Fill surplus slots after the
    -- first pass has assigned each available student at most once for the day.
    if function_oid = 'public.generate_balanced_duty_range(uuid,uuid,date,date,text)'::regprocedure then
      original_definition := updated_definition;
      updated_definition := replace(updated_definition,assignment_marker,assignment_replacement);
      if updated_definition = original_definition then
        raise exception 'Could not add duty slot fallback to %',function_oid;
      end if;
    end if;

    execute updated_definition;
  end loop;
end $$;

notify pgrst,'reload schema';
