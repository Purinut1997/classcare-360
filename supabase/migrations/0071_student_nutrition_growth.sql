-- 0071_student_nutrition_growth.sql
-- Implements Phase 3 of the School Registration & Academic System Specification:
-- Thai Department of Health (กรมอนามัย) 3-standard physical growth & nutrition tracking:
-- 1. Weight-for-Age (น้ำหนักตามเกณฑ์อายุ)
-- 2. Height-for-Age (ส่วนสูงตามเกณฑ์อายุ)
-- 3. Weight-for-Height (น้ำหนักตามเกณฑ์ส่วนสูง)
-- Supports 2 measurement rounds per term.

create table if not exists public.student_growth_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1' check (term in ('1', '2')),
  round_number smallint not null default 1 check (round_number in (1, 2)),
  measured_date date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  height_cm numeric(5,2) not null check (height_cm > 0),
  age_years smallint check (age_years is null or age_years >= 0),
  age_months smallint check (age_months is null or (age_months >= 0 and age_months < 12)),
  weight_for_age text, -- 'น้ำหนักน้อยกว่าเกณฑ์', 'ค่อนข้างน้อย', 'ตามเกณฑ์', 'ค่อนข้างมาก', 'เกินเกณฑ์'
  height_for_age text, -- 'เตี้ย', 'ค่อนข้างเตี้ย', 'สูงตามเกณฑ์', 'ค่อนข้างสูง', 'สูงกว่าเกณฑ์'
  weight_for_height text, -- 'ผอม', 'ค่อนข้างผอม', 'สมส่วน', 'ท้วม', 'เริ่มอ้วน', 'อ้วน'
  bmi numeric(5,2),
  note text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id, academic_year, term, round_number)
);

create index if not exists idx_student_growth_lookup
  on public.student_growth_records(workspace_id, classroom_id, academic_year, term, round_number);

create index if not exists idx_student_growth_student
  on public.student_growth_records(workspace_id, student_id, academic_year);

drop trigger if exists student_growth_touch_updated_at on public.student_growth_records;
create trigger student_growth_touch_updated_at
before update on public.student_growth_records
for each row execute function public.touch_updated_at();

alter table public.student_growth_records enable row level security;

create policy "student_growth_select_staff"
on public.student_growth_records for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "student_growth_insert_staff"
on public.student_growth_records for insert to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "student_growth_update_staff"
on public.student_growth_records for update to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
