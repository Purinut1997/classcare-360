-- Prevent cross-workspace foreign-key relationships even for privileged clients.
-- Existing mismatched classroom links are detached instead of moving students
-- between schools. Guardian rows follow their student because they are owned by
-- that student record.

update public.students s
set classroom_id = null,
    updated_at = now()
where s.classroom_id is not null
  and not exists (
    select 1
    from public.classrooms c
    where c.id = s.classroom_id
      and c.workspace_id = s.workspace_id
  );

update public.student_guardians sg
set workspace_id = s.workspace_id,
    updated_at = now()
from public.students s
where s.id = sg.student_id
  and sg.workspace_id <> s.workspace_id;

create unique index if not exists classrooms_id_workspace_uidx
  on public.classrooms (id, workspace_id);
create unique index if not exists students_id_workspace_uidx
  on public.students (id, workspace_id);

alter table public.students
  drop constraint if exists students_classroom_workspace_fkey;
alter table public.students
  add constraint students_classroom_workspace_fkey
  foreign key (classroom_id, workspace_id)
  references public.classrooms (id, workspace_id);

alter table public.student_guardians
  drop constraint if exists student_guardians_student_workspace_fkey;
alter table public.student_guardians
  add constraint student_guardians_student_workspace_fkey
  foreign key (student_id, workspace_id)
  references public.students (id, workspace_id);

notify pgrst, 'reload schema';
