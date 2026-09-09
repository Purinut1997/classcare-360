-- =============================================================================
-- Migration 0075: Robust Roster Purge, Cascade Integrity, and Permanent Delete
-- =============================================================================
-- 1. Ensure all child tables referencing students(id) have ON DELETE CASCADE
-- 2. Ensure DELETE policy on student_guardians allows teachers
-- 3. Upgrade delete_students_permanently to handle all edge cases cleanly
-- =============================================================================

-- 1. Fix student_guardians foreign keys and ensure cascade
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'student_guardians_student_workspace_fkey'
      and table_schema = 'public'
      and table_name = 'student_guardians'
  ) then
    alter table public.student_guardians
      drop constraint student_guardians_student_workspace_fkey;
  end if;

  alter table public.student_guardians
    add constraint student_guardians_student_workspace_fkey
    foreign key (student_id, workspace_id)
    references public.students (id, workspace_id)
    on delete cascade;

  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'student_guardians_student_id_fkey'
      and table_schema = 'public'
      and table_name = 'student_guardians'
  ) then
    alter table public.student_guardians
      drop constraint student_guardians_student_id_fkey;
    alter table public.student_guardians
      add constraint student_guardians_student_id_fkey
      foreign key (student_id)
      references public.students (id)
      on delete cascade;
  end if;
end $$;

-- 2. Fix student_year_transitions foreign key cascade
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'student_year_transitions_student_id_fkey'
      and table_schema = 'public'
      and table_name = 'student_year_transitions'
  ) then
    alter table public.student_year_transitions
      drop constraint student_year_transitions_student_id_fkey;
    alter table public.student_year_transitions
      add constraint student_year_transitions_student_id_fkey
      foreign key (student_id)
      references public.students (id)
      on delete cascade;
  end if;
end $$;

-- 3. Ensure DELETE policy on student_guardians for workspace teachers
drop policy if exists "student_guardians_delete_teacher_or_superadmin" on public.student_guardians;

create policy "student_guardians_delete_teacher_or_superadmin"
on public.student_guardians
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 4. Ensure DELETE policy on students
drop policy if exists "students_delete_teacher_or_superadmin" on public.students;

create policy "students_delete_teacher_or_superadmin"
on public.students
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 5. Comprehensive, resilient RPC for direct permanent student deletion
create or replace function public.delete_students_permanently(
  target_workspace_id uuid,
  target_student_ids uuid[]
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
  clean_student_ids uuid[];
begin
  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner', 'teacher_member'])
  ) then
    raise exception 'not_allowed';
  end if;

  select array_agg(distinct id) into clean_student_ids
  from unnest(coalesce(target_student_ids, '{}'::uuid[])) as id
  where id is not null;

  if clean_student_ids is null or array_length(clean_student_ids, 1) = 0 then
    return 0;
  end if;

  -- 5.1 Snapshot to trash_items for audit and undo safety
  if to_regclass('public.trash_items') is not null then
    insert into public.trash_items (
      workspace_id, entity_type, entity_id, display_name, reason,
      payload, deleted_by, expires_at, metadata
    )
    select
      s.workspace_id,
      'student',
      s.id,
      concat_ws(' ', s.first_name, s.last_name),
      'permanent_delete',
      to_jsonb(s),
      auth.uid(),
      now() + interval '90 days',
      jsonb_build_object(
        'student_code', s.student_code,
        'classroom_id', s.classroom_id,
        'status', s.status,
        'deleted_at', now()
      )
    from public.students s
    where s.workspace_id = target_workspace_id
      and s.id = any(clean_student_ids);
  end if;

  -- 5.2 Cascade delete child tables explicitly in safe order
  if to_regclass('public.student_guardians') is not null then
    delete from public.student_guardians where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_roster_reviews') is not null then
    delete from public.student_roster_reviews where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_behaviors') is not null then
    delete from public.student_behaviors where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_health_records') is not null then
    delete from public.student_health_records where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_daily_health_logs') is not null then
    delete from public.student_daily_health_logs where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_nutrition_growth') is not null then
    delete from public.student_nutrition_growth where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_savings_transactions') is not null then
    delete from public.student_savings_transactions where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.attendance_records') is not null then
    delete from public.attendance_records where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.score_records') is not null then
    delete from public.score_records where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.desirable_characteristic_records') is not null then
    delete from public.desirable_characteristic_records where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_competency_records') is not null then
    execute 'delete from public.student_competency_records where workspace_id = $1 and student_id = any($2)'
    using target_workspace_id, clean_student_ids;
  end if;
  if to_regclass('public.student_activity_evaluations') is not null then
    execute 'delete from public.student_activity_evaluations where workspace_id = $1 and student_id = any($2)'
    using target_workspace_id, clean_student_ids;
  end if;
  if to_regclass('public.term_student_promotions') is not null then
    delete from public.term_student_promotions where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_year_transitions') is not null then
    delete from public.student_year_transitions where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_care_cases') is not null then
    delete from public.student_care_cases where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_home_visits') is not null then
    delete from public.student_home_visits where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.official_academic_documents') is not null then
    delete from public.official_academic_documents where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.classroom_duty_rosters') is not null then
    delete from public.classroom_duty_rosters where workspace_id = target_workspace_id and student_id = any(clean_student_ids);
    update public.classroom_duty_rosters set substitute_student_id = null where workspace_id = target_workspace_id and substitute_student_id = any(clean_student_ids);
  end if;
  if to_regclass('public.student_profile_links') is not null then
    delete from public.student_profile_links where student_id = any(clean_student_ids);
  end if;

  -- 5.3 Delete students directly
  with deleted as (
    delete from public.students
    where workspace_id = target_workspace_id
      and id = any(clean_student_ids)
    returning id
  )
  select count(*) into deleted_count from deleted;

  -- 5.4 Audit log entry
  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (
      workspace_id, actor_profile_id, entity_table, entity_id,
      action, metadata, risk_level
    ) values (
      target_workspace_id, auth.uid(), 'students', target_workspace_id,
      'students.permanently_deleted',
      jsonb_build_object('count', deleted_count, 'student_ids', clean_student_ids),
      'critical'
    );
  end if;

  return deleted_count;
end;
$$;

revoke all on function public.delete_students_permanently(uuid, uuid[]) from public;
grant execute on function public.delete_students_permanently(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
