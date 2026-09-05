-- Student desirable characteristics (คุณลักษณะอันพึงประสงค์ 8 ประการ)
-- and Reading, Analytical Thinking & Writing (การอ่าน คิดวิเคราะห์ และเขียน)
-- According to OBEC (สพฐ.) core curriculum 2551 standards.

create table if not exists public.student_desirable_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1',
  -- 8 OBEC Desirable Characteristics (0=ไม่ผ่าน, 1=ผ่าน, 2=ดี, 3=ดีเยี่ยม)
  trait_1 smallint not null default 3 check (trait_1 between 0 and 3), -- รักชาติ ศาสน์ กษัตริย์
  trait_2 smallint not null default 3 check (trait_2 between 0 and 3), -- ซื่อสัตย์สุจริต
  trait_3 smallint not null default 3 check (trait_3 between 0 and 3), -- มีวินัย
  trait_4 smallint not null default 3 check (trait_4 between 0 and 3), -- ใฝ่เรียนรู้
  trait_5 smallint not null default 3 check (trait_5 between 0 and 3), -- อยู่อย่างพอเพียง
  trait_6 smallint not null default 3 check (trait_6 between 0 and 3), -- มุ่งมั่นในการทำงาน
  trait_7 smallint not null default 3 check (trait_7 between 0 and 3), -- รักความเป็นไทย
  trait_8 smallint not null default 3 check (trait_8 between 0 and 3), -- มีจิตสาธารณะ
  trait_summary smallint not null default 3 check (trait_summary between 0 and 3), -- สรุปผลคุณลักษณะ 8 ประการ
  -- Reading, Analytical Thinking and Writing (0=ไม่ผ่าน, 1=ผ่าน, 2=ดี, 3=ดีเยี่ยม)
  reading_1 smallint not null default 3 check (reading_1 between 0 and 3), -- การอ่าน
  reading_2 smallint not null default 3 check (reading_2 between 0 and 3), -- การจับใจความและสรุปความ
  reading_3 smallint not null default 3 check (reading_3 between 0 and 3), -- การคิดวิเคราะห์
  reading_4 smallint not null default 3 check (reading_4 between 0 and 3), -- การแสดงความคิดเห็น
  reading_5 smallint not null default 3 check (reading_5 between 0 and 3), -- การสื่อสารและเขียนถ่ายทอด
  reading_summary smallint not null default 3 check (reading_summary between 0 and 3), -- สรุปผลการอ่าน คิดวิเคราะห์ เขียน
  note text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_desirable_records_term_check check (term in ('1', '2', 'yearly')),
  unique (workspace_id, classroom_id, student_id, academic_year, term)
);

create index if not exists student_desirable_records_lookup_idx
  on public.student_desirable_records (workspace_id, classroom_id, academic_year, term);

create index if not exists student_desirable_records_student_idx
  on public.student_desirable_records (workspace_id, student_id, academic_year);

drop trigger if exists student_desirable_records_touch_updated_at on public.student_desirable_records;
create trigger student_desirable_records_touch_updated_at
before update on public.student_desirable_records
for each row execute function public.touch_updated_at();

alter table public.student_desirable_records enable row level security;

drop policy if exists "student_desirable_records_select_staff" on public.student_desirable_records;
create policy "student_desirable_records_select_staff"
on public.student_desirable_records for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

drop policy if exists "student_desirable_records_insert_teacher" on public.student_desirable_records;
create policy "student_desirable_records_insert_teacher"
on public.student_desirable_records for insert
to authenticated
with check (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and recorded_by = auth.uid()
  and exists (
    select 1 from public.students s
    where s.id = student_id
      and s.workspace_id = workspace_id
      and s.classroom_id = classroom_id
      and s.status = 'active'
  )
);

drop policy if exists "student_desirable_records_update_teacher" on public.student_desirable_records;
create policy "student_desirable_records_update_teacher"
on public.student_desirable_records for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and exists (
    select 1 from public.students s
    where s.id = student_id
      and s.workspace_id = workspace_id
      and s.classroom_id = classroom_id
      and s.status = 'active'
  )
);

drop policy if exists "student_desirable_records_delete_teacher" on public.student_desirable_records;
create policy "student_desirable_records_delete_teacher"
on public.student_desirable_records for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

grant select, insert, update, delete on public.student_desirable_records to authenticated;

notify pgrst, 'reload schema';
