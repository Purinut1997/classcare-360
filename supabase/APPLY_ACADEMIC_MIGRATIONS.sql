-- =========================================================================================
-- ClassCare 360: Full Academic & OBEC Registration System Migration
-- Run this script in Supabase Dashboard -> SQL Editor -> Click 'Run'
-- Tables included:
-- 1. academic_years & academic_terms
-- 2. school_subjects & subject_indicators
-- 3. grade_rules (OBEC 8-level 0-4 grading system)
-- 4. student_official_grades
-- 5. student_competency_records (5 Core Competencies)
-- 6. learner_development_activities & student_activity_evaluations
-- 7. student_nutrition_records (Height/Weight/Nutrition Growth)
-- 8. official_academic_documents (PhorPhor 5 & 6 Archives)
-- 9. term_closing_audits (Pre-closing audit checks)
-- =========================================================================================

-- 1. Academic Years
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  year_name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, year_name)
);
create index if not exists idx_academic_years_workspace on public.academic_years(workspace_id, year_name desc);
alter table public.academic_years enable row level security;
drop policy if exists "academic_years_select" on public.academic_years;
create policy "academic_years_select" on public.academic_years for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "academic_years_manage" on public.academic_years;
create policy "academic_years_manage" on public.academic_years for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']));

-- 2. Academic Terms
create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  term_name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, term_name)
);
create index if not exists idx_academic_terms_year on public.academic_terms(academic_year_id);
alter table public.academic_terms enable row level security;
drop policy if exists "academic_terms_select" on public.academic_terms;
create policy "academic_terms_select" on public.academic_terms for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "academic_terms_manage" on public.academic_terms;
create policy "academic_terms_manage" on public.academic_terms for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']));

-- 3. School Subjects Catalog
create table if not exists public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_code text not null,
  subject_name text not null,
  learning_area text not null,
  subject_type text not null default 'basic' check (subject_type in ('basic', 'additional', 'activity')),
  grade_level text not null,
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
alter table public.school_subjects enable row level security;
drop policy if exists "school_subjects_select" on public.school_subjects;
create policy "school_subjects_select" on public.school_subjects for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "school_subjects_insert_update" on public.school_subjects;
create policy "school_subjects_insert_update" on public.school_subjects for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 4. Subject Indicators
create table if not exists public.subject_indicators (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_id uuid not null references public.school_subjects(id) on delete cascade,
  indicator_code text not null,
  indicator_name text not null,
  max_score numeric(5,2) not null default 10.0,
  pass_score numeric(5,2) not null default 5.0,
  term text not null default '1' check (term in ('1', '2', 'yearly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subject_indicators_subject on public.subject_indicators(subject_id);
alter table public.subject_indicators enable row level security;
drop policy if exists "subject_indicators_select" on public.subject_indicators;
create policy "subject_indicators_select" on public.subject_indicators for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "subject_indicators_manage" on public.subject_indicators;
create policy "subject_indicators_manage" on public.subject_indicators for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

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
alter table public.grade_rules enable row level security;
drop policy if exists "grade_rules_select" on public.grade_rules;
create policy "grade_rules_select" on public.grade_rules for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "grade_rules_manage" on public.grade_rules;
create policy "grade_rules_manage" on public.grade_rules for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner']));

-- 6. Student Official Grades
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
  grade text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'locked')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id, subject_id, academic_year, term)
);
create index if not exists idx_student_official_grades_lookup
  on public.student_official_grades(workspace_id, classroom_id, academic_year, term);
alter table public.student_official_grades enable row level security;
drop policy if exists "student_official_grades_select" on public.student_official_grades;
create policy "student_official_grades_select" on public.student_official_grades for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "student_official_grades_manage" on public.student_official_grades;
create policy "student_official_grades_manage" on public.student_official_grades for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 7. Student Core Competencies (5 ด้าน สพฐ.)
create table if not exists public.student_competency_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1' check (term in ('1', '2', 'yearly')),
  comp_communication smallint not null default 3 check (comp_communication between 0 and 3),
  comp_thinking smallint not null default 3 check (comp_thinking between 0 and 3),
  comp_problem_solving smallint not null default 3 check (comp_problem_solving between 0 and 3),
  comp_life_skills smallint not null default 3 check (comp_life_skills between 0 and 3),
  comp_technology smallint not null default 3 check (comp_technology between 0 and 3),
  comp_summary smallint not null default 3 check (comp_summary between 0 and 3),
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, student_id, academic_year, term)
);
create index if not exists idx_student_competency_lookup
  on public.student_competency_records(workspace_id, classroom_id, academic_year, term);
alter table public.student_competency_records enable row level security;
drop policy if exists "student_competency_select_staff" on public.student_competency_records;
create policy "student_competency_select_staff" on public.student_competency_records for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "student_competency_insert_staff" on public.student_competency_records;
create policy "student_competency_insert_staff" on public.student_competency_records for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 8. Learner Development Activities
create table if not exists public.learner_development_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1' check (term in ('1', '2', 'yearly')),
  activity_category text not null check (activity_category in ('guidance', 'scout_cub', 'club', 'social_service')),
  activity_name text not null,
  required_hours numeric(5,1) not null default 20.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classroom_id, academic_year, term, activity_category)
);
alter table public.learner_development_activities enable row level security;
drop policy if exists "learner_dev_act_select" on public.learner_development_activities;
create policy "learner_dev_act_select" on public.learner_development_activities for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "learner_dev_act_manage" on public.learner_development_activities;
create policy "learner_dev_act_manage" on public.learner_development_activities for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 9. Student Activity Evaluations
create table if not exists public.student_activity_evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activity_id uuid not null references public.learner_development_activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attended_hours numeric(5,1) not null default 20.0,
  attendance_percent numeric(5,2) not null default 100.0,
  result text not null default 'pass' check (result in ('pass', 'fail')),
  evaluated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, student_id)
);
alter table public.student_activity_evaluations enable row level security;
drop policy if exists "student_act_eval_select" on public.student_activity_evaluations;
create policy "student_act_eval_select" on public.student_activity_evaluations for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "student_act_eval_manage" on public.student_activity_evaluations;
create policy "student_act_eval_manage" on public.student_activity_evaluations for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 10. Student Nutrition Records
create table if not exists public.student_nutrition_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2569',
  term text not null default '1' check (term in ('1', '2')),
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  height_cm numeric(5,2) not null check (height_cm > 0),
  bmi numeric(4,1) generated always as (round((weight_kg / ((height_cm / 100) * (height_cm / 100)))::numeric, 1)) stored,
  nutrition_status text not null default 'normal'
    check (nutrition_status in ('underweight', 'normal', 'overweight', 'obese')),
  height_status text not null default 'normal'
    check (height_status in ('short', 'rather_short', 'normal', 'tall')),
  measured_at date not null default current_date,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id, academic_year, term)
);
alter table public.student_nutrition_records enable row level security;
drop policy if exists "student_nutrition_select" on public.student_nutrition_records;
create policy "student_nutrition_select" on public.student_nutrition_records for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "student_nutrition_manage" on public.student_nutrition_records;
create policy "student_nutrition_manage" on public.student_nutrition_records for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 11. Official Academic Documents Archives
create table if not exists public.official_academic_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  doc_type text not null check (doc_type in ('pp5_class', 'pp5_subject', 'pp6_term', 'pp6_year', 'certificate')),
  student_id uuid references public.students(id) on delete cascade,
  academic_year text not null,
  term text not null check (term in ('1', '2', 'yearly')),
  doc_title text not null,
  doc_number text,
  snapshot_data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'final', 'archived', 'revoked')),
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.official_academic_documents enable row level security;
drop policy if exists "official_docs_select" on public.official_academic_documents;
create policy "official_docs_select" on public.official_academic_documents for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "official_docs_manage" on public.official_academic_documents;
create policy "official_docs_manage" on public.official_academic_documents for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));

-- 12. Term Closing & Promotion Audits
create table if not exists public.term_closing_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  academic_year text not null,
  term text not null check (term in ('1', '2', 'yearly')),
  audit_summary jsonb not null default '{}'::jsonb,
  ready_count integer not null default 0,
  warning_count integer not null default 0,
  blocked_count integer not null default 0,
  is_approved boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classroom_id, academic_year, term)
);
alter table public.term_closing_audits enable row level security;
drop policy if exists "term_closing_audits_select" on public.term_closing_audits;
create policy "term_closing_audits_select" on public.term_closing_audits for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer']));
drop policy if exists "term_closing_audits_manage" on public.term_closing_audits;
create policy "term_closing_audits_manage" on public.term_closing_audits for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']));
