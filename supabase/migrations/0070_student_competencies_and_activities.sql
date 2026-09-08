-- 0070_student_competencies_and_activities.sql
-- Implements Phase 2 of the School Registration & Academic System Specification:
-- 1. Student Core Competencies (สมรรถนะสำคัญ 5 ประการ สพฐ.)
-- 2. Learner Development Activities (กิจกรรมพัฒนาผู้เรียน 4 กิจกรรม ผ/มผ)

-- 1. Student Core Competencies (0=ไม่ผ่าน, 1=ผ่าน, 2=ดี, 3=ดีเยี่ยม)
create table if not exists public.student_competency_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1' check (term in ('1', '2', 'yearly')),
  -- 5 OBEC Core Competencies
  comp_communication smallint not null default 3 check (comp_communication between 0 and 3), -- ความสามารถในการสื่อสาร
  comp_thinking smallint not null default 3 check (comp_thinking between 0 and 3), -- ความสามารถในการคิด
  comp_problem_solving smallint not null default 3 check (comp_problem_solving between 0 and 3), -- ความสามารถในการแก้ปัญหา
  comp_life_skills smallint not null default 3 check (comp_life_skills between 0 and 3), -- ความสามารถในการใช้ทักษะชีวิต
  comp_technology smallint not null default 3 check (comp_technology between 0 and 3), -- ความสามารถในการใช้เทคโนโลยี
  comp_summary smallint not null default 3 check (comp_summary between 0 and 3), -- สรุปผลสมรรถนะรวม
  note text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, student_id, academic_year, term)
);

create index if not exists idx_student_competency_lookup
  on public.student_competency_records(workspace_id, classroom_id, academic_year, term);

create index if not exists idx_student_competency_student
  on public.student_competency_records(workspace_id, student_id, academic_year);

drop trigger if exists student_competency_touch_updated_at on public.student_competency_records;
create trigger student_competency_touch_updated_at
before update on public.student_competency_records
for each row execute function public.touch_updated_at();

alter table public.student_competency_records enable row level security;

create policy "student_competency_select_staff"
on public.student_competency_records for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "student_competency_insert_staff"
on public.student_competency_records for insert to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "student_competency_update_staff"
on public.student_competency_records for update to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 2. Learner Development Activities (กิจกรรมพัฒนาผู้เรียน)
create table if not exists public.student_activity_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1' check (term in ('1', '2', 'yearly')),
  -- 4 Learner Development Activities ('pass' = ผ่าน, 'fail' = ไม่ผ่าน, 'exempt' = ได้รับการยกเว้น)
  act_guidance text not null default 'pass' check (act_guidance in ('pass', 'fail', 'exempt')), -- กิจกรรมแนะแนว
  act_scout text not null default 'pass' check (act_scout in ('pass', 'fail', 'exempt')), -- กิจกรรมลูกเสือ / เนตรนารี / ยุวกาชาด
  act_club text not null default 'pass' check (act_club in ('pass', 'fail', 'exempt')), -- กิจกรรมชุมนุม / ชมรม
  act_social text not null default 'pass' check (act_social in ('pass', 'fail', 'exempt')), -- กิจกรรมเพื่อสังคมและสาธารณประโยชน์
  act_summary text not null default 'pass' check (act_summary in ('pass', 'fail', 'exempt')), -- สรุปผลกิจกรรมรวม
  note text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, student_id, academic_year, term)
);

create index if not exists idx_student_activity_lookup
  on public.student_activity_records(workspace_id, classroom_id, academic_year, term);

create index if not exists idx_student_activity_student
  on public.student_activity_records(workspace_id, student_id, academic_year);

drop trigger if exists student_activity_touch_updated_at on public.student_activity_records;
create trigger student_activity_touch_updated_at
before update on public.student_activity_records
for each row execute function public.touch_updated_at();

alter table public.student_activity_records enable row level security;

create policy "student_activity_select_staff"
on public.student_activity_records for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "student_activity_insert_staff"
on public.student_activity_records for insert to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "student_activity_update_staff"
on public.student_activity_records for update to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
