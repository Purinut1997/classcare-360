-- 0073_term_closing_and_promotion_audits.sql
-- Implements Phase 5 of the School Registration & Academic System Specification:
-- 1. Term closing audits (Pre-closing audit checklist, data completeness logs)
-- 2. Student promotions ledger (Official promotion decisions: promoted, retained, graduated, pending)
-- 3. Locking capability and audit trail for academic terms

-- 1. Term Closing Audits Table
create table if not exists public.term_closing_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  academic_year text not null, -- e.g. '2569'
  term text not null,          -- e.g. '1', '2'
  status text not null default 'draft' check (status in ('draft', 'audited', 'locked', 'reopened')),
  total_students integer not null default 0,
  promoted_count integer not null default 0,
  retained_count integer not null default 0,
  graduated_count integer not null default 0,
  pending_count integer not null default 0,
  audit_issues jsonb not null default '[]'::jsonb,
  audit_summary jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, academic_year, term)
);

create index if not exists idx_term_closing_audits_lookup
  on public.term_closing_audits(workspace_id, academic_year, term);

drop trigger if exists term_closing_audits_touch_updated_at on public.term_closing_audits;
create trigger term_closing_audits_touch_updated_at
before update on public.term_closing_audits
for each row execute function public.touch_updated_at();

alter table public.term_closing_audits enable row level security;

create policy "term_closing_audits_select"
on public.term_closing_audits for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "term_closing_audits_manage"
on public.term_closing_audits for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 2. Student Promotions Ledger Table
create table if not exists public.student_promotions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  academic_year text not null,
  term text not null,
  decision text not null check (decision in ('promoted', 'retained', 'graduated', 'pending_remedial')),
  from_grade_level text not null, -- e.g. 'ป.5'
  to_grade_level text,            -- e.g. 'ป.6' or null if graduated
  attendance_rate numeric(5, 2),  -- e.g. 88.50
  gpa numeric(3, 2),              -- e.g. 3.45
  desirable_traits_result text default 'ผ่าน',
  reading_writing_result text default 'ผ่าน',
  activities_result text default 'ผ่าน',
  remarks text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id, academic_year, term)
);

create index if not exists idx_student_promotions_lookup
  on public.student_promotions(workspace_id, student_id, academic_year, term);

create index if not exists idx_student_promotions_classroom
  on public.student_promotions(workspace_id, classroom_id, academic_year);

drop trigger if exists student_promotions_touch_updated_at on public.student_promotions;
create trigger student_promotions_touch_updated_at
before update on public.student_promotions
for each row execute function public.touch_updated_at();

alter table public.student_promotions enable row level security;

create policy "student_promotions_select"
on public.student_promotions for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

create policy "student_promotions_manage"
on public.student_promotions for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
