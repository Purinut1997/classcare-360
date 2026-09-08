-- 0069_academic_structure_and_subjects.sql
-- Implements Phase 1 of the School Registration & Academic System Specification:
-- 1. Academic years & terms with lock states
-- 2. Central school subjects catalog (8 OBEC learning areas)
-- 3. Subject standards and indicators
-- 4. School customizable grade rules
-- 5. Approved student official grades snapshot

-- 1. Academic Years
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  year_name text not null, -- e.g. '2569'
  start_date date,
  end_date date,
  is_current boolean not null default false,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, year_name)
);

create index if not exists idx_academic_years_workspace on public.academic_years(workspace_id, year_name desc);

drop trigger if exists academic_years_touch_updated_at on public.academic_years;
create trigger academic_years_touch_updated_at
before update on public.academic_years
for each row execute function public.touch_updated_at();

alter table public.academic_years enable row level security;

create policy "academic_years_select"
on public.academic_years for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "academic_years_manage"
on public.academic_years for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

-- 2. Academic Terms
create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  term_name text not null, -- '1', '2', 'summer'
  start_date date,
  end_date date,
  is_current boolean not null default false,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, term_name)
);

create index if not exists idx_academic_terms_year on public.academic_terms(academic_year_id);

drop trigger if exists academic_terms_touch_updated_at on public.academic_terms;
create trigger academic_terms_touch_updated_at
before update on public.academic_terms
for each row execute function public.touch_updated_at();

alter table public.academic_terms enable row level security;

create policy "academic_terms_select"
on public.academic_terms for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "academic_terms_manage"
on public.academic_terms for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

-- 3. School Subjects Catalog
create table if not exists public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_code text not null, -- e.g. 'ท11101'
  subject_name text not null, -- e.g. 'ภาษาไทย 1'
  learning_area text not null, -- e.g. 'ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี'
  subject_type text not null default 'basic' check (subject_type in ('basic', 'additional', 'activity')),
  grade_level text not null, -- e.g. 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'
  hours_per_year numeric(6,1) not null default 40,
  hours_per_week numeric(4,1) not null default 1,
  credit numeric(4,2) not null default 1.0,
  teacher_profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, subject_code, grade_level)
);

create index if not exists idx_school_subjects_workspace_level on public.school_subjects(workspace_id, grade_level);

drop trigger if exists school_subjects_touch_updated_at on public.school_subjects;
create trigger school_subjects_touch_updated_at
before update on public.school_subjects
for each row execute function public.touch_updated_at();

alter table public.school_subjects enable row level security;

create policy "school_subjects_select"
on public.school_subjects for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "school_subjects_insert_update"
on public.school_subjects for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 4. Subject Indicators (มาตรฐานและตัวชี้วัด)
create table if not exists public.subject_indicators (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_id uuid not null references public.school_subjects(id) on delete cascade,
  standard_code text not null, -- e.g. 'ท 1.1'
  indicator_code text not null, -- e.g. 'ป.1/1'
  indicator_name text not null,
  term text not null default '1' check (term in ('1', '2', 'yearly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, indicator_code)
);

create index if not exists idx_subject_indicators_subject on public.subject_indicators(subject_id);

drop trigger if exists subject_indicators_touch_updated_at on public.subject_indicators;
create trigger subject_indicators_touch_updated_at
before update on public.subject_indicators
for each row execute function public.touch_updated_at();

alter table public.subject_indicators enable row level security;

create policy "subject_indicators_select"
on public.subject_indicators for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "subject_indicators_manage"
on public.subject_indicators for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 5. Customizable Grade Rules
create table if not exists public.grade_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  min_score numeric(5,2) not null,
  max_score numeric(5,2) not null,
  grade text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_grade_rules_workspace on public.grade_rules(workspace_id);

drop trigger if exists grade_rules_touch_updated_at on public.grade_rules;
create trigger grade_rules_touch_updated_at
before update on public.grade_rules
for each row execute function public.touch_updated_at();

alter table public.grade_rules enable row level security;

create policy "grade_rules_select"
on public.grade_rules for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "grade_rules_manage"
on public.grade_rules for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

-- 6. Official Student Grades Snapshot
create table if not exists public.student_official_grades (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.school_subjects(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  academic_year text not null,
  term text not null check (term in ('1', '2', 'yearly')),
  accumulated_score numeric(6,2),
  midterm_score numeric(6,2),
  final_score numeric(6,2),
  total_score numeric(6,2) not null,
  percentage numeric(5,2),
  grade text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'locked')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id, subject_id, academic_year, term)
);

create index if not exists idx_student_official_grades_lookup
  on public.student_official_grades(workspace_id, classroom_id, academic_year, term);

create index if not exists idx_student_official_grades_student
  on public.student_official_grades(workspace_id, student_id, academic_year);

drop trigger if exists student_official_grades_touch_updated_at on public.student_official_grades;
create trigger student_official_grades_touch_updated_at
before update on public.student_official_grades
for each row execute function public.touch_updated_at();

alter table public.student_official_grades enable row level security;

create policy "student_official_grades_select"
on public.student_official_grades for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "student_official_grades_manage"
on public.student_official_grades for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
