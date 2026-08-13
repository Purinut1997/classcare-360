-- Enforce classroom scope and cross-record integrity for daily teacher data.

create or replace function public.can_access_attendance_session(target_workspace_id uuid, target_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.attendance_sessions s
    where s.id = target_session_id
      and s.workspace_id = target_workspace_id
      and public.can_access_classroom(s.workspace_id, s.classroom_id)
  );
$$;

create or replace function public.can_access_score_assessment(target_workspace_id uuid, target_assessment_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.score_assessments a
    where a.id = target_assessment_id
      and a.workspace_id = target_workspace_id
      and public.can_access_classroom(a.workspace_id, a.classroom_id)
  );
$$;

create or replace function public.validate_activity_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  related_workspace_id uuid;
  related_classroom_id uuid;
  student_workspace_id uuid;
  student_classroom_id uuid;
begin
  if tg_table_name = 'attendance_sessions' then
    select c.workspace_id into related_workspace_id from public.classrooms c where c.id = new.classroom_id;
    if related_workspace_id is null or related_workspace_id <> new.workspace_id then
      raise exception 'attendance_classroom_workspace_mismatch';
    end if;
  elsif tg_table_name = 'attendance_records' then
    select s.workspace_id, s.classroom_id into related_workspace_id, related_classroom_id
    from public.attendance_sessions s where s.id = new.session_id;
    select s.workspace_id, s.classroom_id into student_workspace_id, student_classroom_id
    from public.students s where s.id = new.student_id;
    if related_workspace_id is null or student_workspace_id is null
      or related_workspace_id <> new.workspace_id or student_workspace_id <> new.workspace_id
      or student_classroom_id is distinct from related_classroom_id then
      raise exception 'attendance_record_scope_mismatch';
    end if;
  elsif tg_table_name = 'score_assessments' then
    select c.workspace_id into related_workspace_id from public.classrooms c where c.id = new.classroom_id;
    if related_workspace_id is null or related_workspace_id <> new.workspace_id then
      raise exception 'score_classroom_workspace_mismatch';
    end if;
  elsif tg_table_name = 'score_entries' then
    select a.workspace_id, a.classroom_id into related_workspace_id, related_classroom_id
    from public.score_assessments a where a.id = new.assessment_id;
    select s.workspace_id, s.classroom_id into student_workspace_id, student_classroom_id
    from public.students s where s.id = new.student_id;
    if related_workspace_id is null or student_workspace_id is null
      or related_workspace_id <> new.workspace_id or student_workspace_id <> new.workspace_id
      or student_classroom_id is distinct from related_classroom_id then
      raise exception 'score_entry_scope_mismatch';
    end if;
  elsif tg_table_name = 'student_health_records' then
    select s.workspace_id, s.classroom_id into student_workspace_id, student_classroom_id
    from public.students s where s.id = new.student_id;
    if student_workspace_id is null or student_workspace_id <> new.workspace_id
      or student_classroom_id is distinct from new.classroom_id then
      raise exception 'health_record_scope_mismatch';
    end if;
  else
    select s.workspace_id into student_workspace_id from public.students s where s.id = new.student_id;
    if student_workspace_id is null or student_workspace_id <> new.workspace_id then
      raise exception 'student_activity_workspace_mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sessions_validate_scope on public.attendance_sessions;
create trigger attendance_sessions_validate_scope before insert or update on public.attendance_sessions
for each row execute function public.validate_activity_scope();
drop trigger if exists attendance_records_validate_scope on public.attendance_records;
create trigger attendance_records_validate_scope before insert or update on public.attendance_records
for each row execute function public.validate_activity_scope();
drop trigger if exists score_assessments_validate_scope on public.score_assessments;
create trigger score_assessments_validate_scope before insert or update on public.score_assessments
for each row execute function public.validate_activity_scope();
drop trigger if exists score_entries_validate_scope on public.score_entries;
create trigger score_entries_validate_scope before insert or update on public.score_entries
for each row execute function public.validate_activity_scope();
drop trigger if exists savings_accounts_validate_scope on public.savings_accounts;
create trigger savings_accounts_validate_scope before insert or update on public.savings_accounts
for each row execute function public.validate_activity_scope();
drop trigger if exists savings_transactions_validate_scope on public.savings_transactions;
create trigger savings_transactions_validate_scope before insert or update on public.savings_transactions
for each row execute function public.validate_activity_scope();
drop trigger if exists behavior_records_validate_scope on public.behavior_records;
create trigger behavior_records_validate_scope before insert or update on public.behavior_records
for each row execute function public.validate_activity_scope();
drop trigger if exists student_care_cases_validate_scope on public.student_care_cases;
create trigger student_care_cases_validate_scope before insert or update on public.student_care_cases
for each row execute function public.validate_activity_scope();
drop trigger if exists student_home_visits_validate_scope on public.student_home_visits;
create trigger student_home_visits_validate_scope before insert or update on public.student_home_visits
for each row execute function public.validate_activity_scope();
drop trigger if exists student_health_records_validate_scope on public.student_health_records;
create trigger student_health_records_validate_scope before insert or update on public.student_health_records
for each row execute function public.validate_activity_scope();

-- Attendance: preserve parent/student portal reads while scoping staff.
drop policy if exists "attendance_sessions_select_workspace_or_superadmin" on public.attendance_sessions;
create policy "attendance_sessions_select_scoped_or_linked_portal"
on public.attendance_sessions for select to authenticated
using (
  public.can_access_classroom(workspace_id, classroom_id)
  or exists (
    select 1 from public.attendance_records ar join public.student_guardians sg on sg.student_id = ar.student_id
    where ar.session_id = attendance_sessions.id and ar.workspace_id = attendance_sessions.workspace_id
      and sg.profile_id = auth.uid() and sg.workspace_id = attendance_sessions.workspace_id and sg.consent_status = 'granted'
  )
  or exists (
    select 1 from public.attendance_records ar join public.student_profile_links spl on spl.student_id = ar.student_id
    where ar.session_id = attendance_sessions.id and ar.workspace_id = attendance_sessions.workspace_id
      and spl.profile_id = auth.uid() and spl.workspace_id = attendance_sessions.workspace_id and spl.status = 'active'
  )
);

drop policy if exists "attendance_sessions_insert_teacher_or_superadmin" on public.attendance_sessions;
create policy "attendance_sessions_insert_scoped_teacher"
on public.attendance_sessions for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_workspace_capability(workspace_id, 'attendance.write')
  and public.can_access_classroom(workspace_id, classroom_id)
);

drop policy if exists "attendance_sessions_update_teacher_or_superadmin" on public.attendance_sessions;
create policy "attendance_sessions_update_scoped_teacher"
on public.attendance_sessions for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'attendance.write')
  and public.can_access_classroom(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'attendance.write')
  and public.can_access_classroom(workspace_id, classroom_id)
);

drop policy if exists "attendance_records_select_workspace_parent_student_or_superadmin" on public.attendance_records;
create policy "attendance_records_select_scoped_or_linked_portal"
on public.attendance_records for select to authenticated
using (
  public.can_access_student(workspace_id, student_id)
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = attendance_records.student_id and sg.profile_id = auth.uid()
      and sg.workspace_id = attendance_records.workspace_id and sg.consent_status = 'granted'
  )
  or exists (
    select 1 from public.student_profile_links spl
    where spl.student_id = attendance_records.student_id and spl.profile_id = auth.uid()
      and spl.workspace_id = attendance_records.workspace_id and spl.status = 'active'
  )
);

drop policy if exists "attendance_records_insert_teacher_or_superadmin" on public.attendance_records;
create policy "attendance_records_insert_scoped_teacher"
on public.attendance_records for insert to authenticated
with check (
  checked_by = auth.uid()
  and public.has_workspace_capability(workspace_id, 'attendance.write')
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_attendance_session(workspace_id, session_id)
);

drop policy if exists "attendance_records_update_teacher_or_superadmin" on public.attendance_records;
create policy "attendance_records_update_scoped_teacher"
on public.attendance_records for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'attendance.write')
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_attendance_session(workspace_id, session_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'attendance.write')
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_attendance_session(workspace_id, session_id)
);

-- Scores.
drop policy if exists "score_assessments_select_teacher_or_superadmin" on public.score_assessments;
create policy "score_assessments_select_scoped_staff" on public.score_assessments for select to authenticated
using (public.can_access_classroom(workspace_id, classroom_id));
drop policy if exists "score_assessments_insert_teacher_or_superadmin" on public.score_assessments;
create policy "score_assessments_insert_scoped_teacher" on public.score_assessments for insert to authenticated
with check (public.has_workspace_capability(workspace_id, 'scores.write') and public.can_access_classroom(workspace_id, classroom_id));
drop policy if exists "score_assessments_update_teacher_or_superadmin" on public.score_assessments;
create policy "score_assessments_update_scoped_teacher" on public.score_assessments for update to authenticated
using (public.has_workspace_capability(workspace_id, 'scores.write') and public.can_access_classroom(workspace_id, classroom_id))
with check (public.has_workspace_capability(workspace_id, 'scores.write') and public.can_access_classroom(workspace_id, classroom_id));

drop policy if exists "score_entries_select_teacher_or_superadmin" on public.score_entries;
create policy "score_entries_select_scoped_staff" on public.score_entries for select to authenticated
using (public.can_access_student(workspace_id, student_id) and public.can_access_score_assessment(workspace_id, assessment_id));
drop policy if exists "score_entries_insert_teacher_or_superadmin" on public.score_entries;
create policy "score_entries_insert_scoped_teacher" on public.score_entries for insert to authenticated
with check (
  public.has_workspace_capability(workspace_id, 'scores.write')
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_score_assessment(workspace_id, assessment_id)
);
drop policy if exists "score_entries_update_teacher_or_superadmin" on public.score_entries;
create policy "score_entries_update_scoped_teacher" on public.score_entries for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'scores.write')
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_score_assessment(workspace_id, assessment_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'scores.write')
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_score_assessment(workspace_id, assessment_id)
);

-- Student-scoped modules.
drop policy if exists "savings_accounts_select_teacher_or_superadmin" on public.savings_accounts;
create policy "savings_accounts_select_scoped_staff" on public.savings_accounts for select to authenticated
using (public.can_access_student(workspace_id, student_id));
drop policy if exists "savings_accounts_upsert_teacher_or_superadmin" on public.savings_accounts;
create policy "savings_accounts_write_scoped_teacher" on public.savings_accounts for all to authenticated
using (public.has_workspace_capability(workspace_id, 'savings.write') and public.can_access_student(workspace_id, student_id))
with check (public.has_workspace_capability(workspace_id, 'savings.write') and public.can_access_student(workspace_id, student_id));

drop policy if exists "savings_transactions_select_teacher_or_superadmin" on public.savings_transactions;
create policy "savings_transactions_select_scoped_staff" on public.savings_transactions for select to authenticated
using (public.can_access_student(workspace_id, student_id));
drop policy if exists "savings_transactions_insert_teacher_or_superadmin" on public.savings_transactions;
create policy "savings_transactions_insert_scoped_teacher" on public.savings_transactions for insert to authenticated
with check (public.has_workspace_capability(workspace_id, 'savings.write') and public.can_access_student(workspace_id, student_id));

drop policy if exists "behavior_records_select_teacher_or_superadmin" on public.behavior_records;
create policy "behavior_records_select_scoped_staff" on public.behavior_records for select to authenticated
using (public.can_access_student(workspace_id, student_id));
drop policy if exists "behavior_records_insert_teacher_or_superadmin" on public.behavior_records;
create policy "behavior_records_insert_scoped_teacher" on public.behavior_records for insert to authenticated
with check (public.has_workspace_capability(workspace_id, 'behavior.write') and public.can_access_student(workspace_id, student_id));
drop policy if exists "behavior_records_update_teacher_or_superadmin" on public.behavior_records;
create policy "behavior_records_update_scoped_teacher" on public.behavior_records for update to authenticated
using (public.has_workspace_capability(workspace_id, 'behavior.write') and public.can_access_student(workspace_id, student_id))
with check (public.has_workspace_capability(workspace_id, 'behavior.write') and public.can_access_student(workspace_id, student_id));

drop policy if exists "student_care_cases_select_teacher_or_superadmin" on public.student_care_cases;
create policy "student_care_cases_select_scoped_teacher" on public.student_care_cases for select to authenticated
using (public.can_access_student(workspace_id, student_id));
drop policy if exists "student_care_cases_insert_teacher_or_superadmin" on public.student_care_cases;
create policy "student_care_cases_insert_scoped_teacher" on public.student_care_cases for insert to authenticated
with check (public.has_workspace_capability(workspace_id, 'student_care.write') and public.can_access_student(workspace_id, student_id));
drop policy if exists "student_care_cases_update_owner_teacher_or_superadmin" on public.student_care_cases;
create policy "student_care_cases_update_scoped_teacher" on public.student_care_cases for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'student_care.write')
  and public.can_access_student(workspace_id, student_id)
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']) or assigned_to = auth.uid() or opened_by = auth.uid())
)
with check (
  public.has_workspace_capability(workspace_id, 'student_care.write')
  and public.can_access_student(workspace_id, student_id)
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']) or assigned_to = auth.uid() or opened_by = auth.uid())
);

drop policy if exists "student_home_visits_select_teacher_or_superadmin" on public.student_home_visits;
create policy "student_home_visits_select_scoped_teacher" on public.student_home_visits for select to authenticated
using (public.can_access_student(workspace_id, student_id));
drop policy if exists "student_home_visits_insert_teacher_or_superadmin" on public.student_home_visits;
create policy "student_home_visits_insert_scoped_teacher" on public.student_home_visits for insert to authenticated
with check (public.has_workspace_capability(workspace_id, 'home_visits.write') and public.can_access_student(workspace_id, student_id));
drop policy if exists "student_home_visits_update_teacher_or_superadmin" on public.student_home_visits;
create policy "student_home_visits_update_scoped_teacher" on public.student_home_visits for update to authenticated
using (public.has_workspace_capability(workspace_id, 'home_visits.write') and public.can_access_student(workspace_id, student_id))
with check (public.has_workspace_capability(workspace_id, 'home_visits.write') and public.can_access_student(workspace_id, student_id));

drop policy if exists "student_health_records_select_workspace_staff" on public.student_health_records;
create policy "student_health_records_select_scoped_staff" on public.student_health_records for select to authenticated
using (public.can_access_classroom(workspace_id, classroom_id) and public.can_access_student(workspace_id, student_id));
drop policy if exists "student_health_records_insert_workspace_teacher" on public.student_health_records;
create policy "student_health_records_insert_scoped_teacher" on public.student_health_records for insert to authenticated
with check (
  recorded_by = auth.uid()
  and public.has_workspace_capability(workspace_id, 'student_care.write')
  and public.can_access_classroom(workspace_id, classroom_id)
  and public.can_access_student(workspace_id, student_id)
);
drop policy if exists "student_health_records_update_workspace_teacher" on public.student_health_records;
create policy "student_health_records_update_scoped_teacher" on public.student_health_records for update to authenticated
using (
  public.has_workspace_capability(workspace_id, 'student_care.write')
  and public.can_access_classroom(workspace_id, classroom_id)
  and public.can_access_student(workspace_id, student_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'student_care.write')
  and public.can_access_classroom(workspace_id, classroom_id)
  and public.can_access_student(workspace_id, student_id)
);
drop policy if exists "student_health_records_delete_workspace_teacher" on public.student_health_records;
create policy "student_health_records_delete_scoped_teacher" on public.student_health_records for delete to authenticated
using (
  public.has_workspace_capability(workspace_id, 'student_care.write')
  and public.can_access_classroom(workspace_id, classroom_id)
  and public.can_access_student(workspace_id, student_id)
);

revoke all on function public.can_access_attendance_session(uuid, uuid) from public;
revoke all on function public.can_access_score_assessment(uuid, uuid) from public;
grant execute on function public.can_access_attendance_session(uuid, uuid) to authenticated;
grant execute on function public.can_access_score_assessment(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
