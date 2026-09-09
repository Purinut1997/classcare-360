-- =============================================================================
-- Migration 0074: Fix Student Deletion Cascades, Policies, and Permanent Delete RPC
-- =============================================================================
-- 1. Ensure foreign key constraints cascading on student deletion
-- 2. Add DELETE policy on student_guardians for workspace teachers
-- 3. Allow teacher_member with roster permissions to delete students
-- 4. Provide foolproof RPC delete_students_permanently (deletes directly without archiving first)
-- 5. Safe table checks with to_regclass to prevent relation errors
-- =============================================================================

-- 1. Fix foreign key constraint on student_guardians
alter table public.student_guardians
  drop constraint if exists student_guardians_student_workspace_fkey;

alter table public.student_guardians
  add constraint student_guardians_student_workspace_fkey
  foreign key (student_id, workspace_id)
  references public.students (id, workspace_id)
  on delete cascade;

-- If legacy student_id foreign key constraint exists on student_guardians, ensure it cascades too
do $$
begin
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

-- 2. Fix foreign key constraint on student_year_transitions (was on delete restrict)
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

-- 3. Add DELETE policy on student_guardians
drop policy if exists "student_guardians_delete_teacher_or_superadmin" on public.student_guardians;

create policy "student_guardians_delete_teacher_or_superadmin"
on public.student_guardians
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 4. Update DELETE policy on students (allows deleting active, duplicate, or archived students directly)
drop policy if exists "students_delete_owner_or_superadmin" on public.students;
drop policy if exists "students_delete_teacher_or_superadmin" on public.students;

create policy "students_delete_teacher_or_superadmin"
on public.students
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 5. Comprehensive RPC for direct permanent student deletion (NO archiving required!)
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

  -- Archive records to trash_items before purging (allows undo / audit)
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

  -- Explicit cascade deletion of child records (guarded with to_regclass so missing tables won't cause errors)
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

  -- Purge students directly from students table (regardless of active or archived status)
  with deleted as (
    delete from public.students
    where workspace_id = target_workspace_id
      and id = any(clean_student_ids)
    returning id
  )
  select count(*) into deleted_count from deleted;

  -- Audit log entry
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

-- 6. Also upgrade delete_reviewed_duplicate_students to directly delete without requiring archived status
create or replace function public.delete_reviewed_duplicate_students(
  target_workspace_id uuid,
  target_student_ids uuid[]
)
returns integer
language plpgsql security definer
set search_path = public
as $$
begin
  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner', 'teacher_member'])
  ) then
    raise exception 'not_allowed';
  end if;

  return public.delete_students_permanently(target_workspace_id, target_student_ids);
end;
$$;

revoke all on function public.delete_students_permanently(uuid, uuid[]) from public;
revoke all on function public.delete_reviewed_duplicate_students(uuid, uuid[]) from public;

grant execute on function public.delete_students_permanently(uuid, uuid[]) to authenticated;
grant execute on function public.delete_reviewed_duplicate_students(uuid, uuid[]) to authenticated;

-- 7. Ensure import_jobs has metadata column
do $$
begin
  if to_regclass('public.import_jobs') is not null then
    alter table public.import_jobs
      add column if not exists metadata jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- 8. Clean up redundant empty classrooms (e.g. 'ป.5' with 0 students when 'ป.5/1' exists)
do $$
declare
  r record;
begin
  for r in (
    select c.id, c.name
    from public.classrooms c
    where c.name in ('ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ประถมศึกษาปีที่ 1', 'ประถมศึกษาปีที่ 2', 'ประถมศึกษาปีที่ 3', 'ประถมศึกษาปีที่ 4', 'ประถมศึกษาปีที่ 5', 'ประถมศึกษาปีที่ 6')
      and not exists (
        select 1 from public.students s where s.classroom_id = c.id
      )
      and exists (
        select 1 from public.classrooms other
        where other.workspace_id = c.workspace_id
          and other.id <> c.id
          and other.name like c.name || '/%'
      )
  ) loop
    begin
      delete from public.classrooms where id = r.id;
    exception when others then
      update public.classrooms set status = 'archived' where id = r.id;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
