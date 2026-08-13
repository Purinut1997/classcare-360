-- Health records are sensitive raw data: teacher-only, classroom-scoped, and premium-entitled.

drop policy if exists "student_health_records_select_scoped_staff" on public.student_health_records;
drop policy if exists "student_health_records_select_workspace_staff" on public.student_health_records;
create policy "student_health_records_select_entitled_teachers"
on public.student_health_records for select to authenticated
using (
  public.can_use_module(workspace_id, 'student_care')
  and (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and public.can_access_classroom(workspace_id, classroom_id)
  and public.can_access_student(workspace_id, student_id)
);

notify pgrst, 'reload schema';
