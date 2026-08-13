-- Harden activity integrity checks and keep sensitive raw records teacher-only.

create or replace function public.validate_activity_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_workspace_id uuid;
  related_classroom_id uuid;
  student_workspace_id uuid;
  student_classroom_id uuid;
  account_workspace_id uuid;
  account_student_id uuid;
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
  elsif tg_table_name = 'savings_transactions' then
    select s.workspace_id into student_workspace_id from public.students s where s.id = new.student_id;
    if student_workspace_id is null or student_workspace_id <> new.workspace_id then
      raise exception 'student_activity_workspace_mismatch';
    end if;
    if new.account_id is not null then
      select a.workspace_id, a.student_id into account_workspace_id, account_student_id
      from public.savings_accounts a where a.id = new.account_id;
      if account_workspace_id is null or account_workspace_id <> new.workspace_id
        or account_student_id <> new.student_id then
        raise exception 'savings_transaction_account_scope_mismatch';
      end if;
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

revoke all on function public.validate_activity_scope() from public;

-- Viewers should use report surfaces, not sensitive raw activity tables.
drop policy if exists "score_assessments_select_scoped_staff" on public.score_assessments;
create policy "score_assessments_select_scoped_teachers"
on public.score_assessments for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_classroom(workspace_id, classroom_id)
);

drop policy if exists "score_entries_select_scoped_staff" on public.score_entries;
create policy "score_entries_select_scoped_teachers"
on public.score_entries for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
  and public.can_access_score_assessment(workspace_id, assessment_id)
);

drop policy if exists "savings_accounts_select_scoped_staff" on public.savings_accounts;
create policy "savings_accounts_select_scoped_teachers"
on public.savings_accounts for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);

drop policy if exists "savings_transactions_select_scoped_staff" on public.savings_transactions;
create policy "savings_transactions_select_scoped_teachers"
on public.savings_transactions for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);

drop policy if exists "behavior_records_select_scoped_staff" on public.behavior_records;
create policy "behavior_records_select_scoped_teachers"
on public.behavior_records for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);

drop policy if exists "student_care_cases_select_scoped_teacher" on public.student_care_cases;
create policy "student_care_cases_select_scoped_teachers"
on public.student_care_cases for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);

drop policy if exists "student_home_visits_select_scoped_teacher" on public.student_home_visits;
create policy "student_home_visits_select_scoped_teachers"
on public.student_home_visits for select to authenticated
using (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_student(workspace_id, student_id)
);

notify pgrst, 'reload schema';
