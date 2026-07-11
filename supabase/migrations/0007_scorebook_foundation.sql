-- ClassCare 360 - Score Center foundation.
-- Adds classroom-level score assessments and per-student score entries.

create table if not exists public.score_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  subject_name text not null,
  category text not null default 'quiz'
    check (category in ('quiz', 'assignment', 'exam', 'project', 'reading', 'other')),
  max_score numeric(8,2) not null default 100
    check (max_score > 0),
  weight numeric(8,2) not null default 10
    check (weight > 0),
  assessment_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.score_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assessment_id uuid not null references public.score_assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(8,2)
    check (score is null or score >= 0),
  note text,
  graded_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create index if not exists score_assessments_workspace_classroom_idx
on public.score_assessments (workspace_id, classroom_id, assessment_date desc);

create index if not exists score_assessments_workspace_subject_idx
on public.score_assessments (workspace_id, subject_name, assessment_date desc);

create index if not exists score_entries_workspace_assessment_idx
on public.score_entries (workspace_id, assessment_id);

create index if not exists score_entries_workspace_student_idx
on public.score_entries (workspace_id, student_id, updated_at desc);

drop trigger if exists score_assessments_touch_updated_at on public.score_assessments;
create trigger score_assessments_touch_updated_at
before update on public.score_assessments
for each row execute function public.touch_updated_at();

drop trigger if exists score_entries_touch_updated_at on public.score_entries;
create trigger score_entries_touch_updated_at
before update on public.score_entries
for each row execute function public.touch_updated_at();

alter table public.score_assessments enable row level security;
alter table public.score_entries enable row level security;

drop policy if exists "score_assessments_select_teacher_or_superadmin" on public.score_assessments;
create policy "score_assessments_select_teacher_or_superadmin"
on public.score_assessments
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "score_assessments_insert_teacher_or_superadmin" on public.score_assessments;
create policy "score_assessments_insert_teacher_or_superadmin"
on public.score_assessments
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "score_assessments_update_teacher_or_superadmin" on public.score_assessments;
create policy "score_assessments_update_teacher_or_superadmin"
on public.score_assessments
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "score_entries_select_teacher_or_superadmin" on public.score_entries;
create policy "score_entries_select_teacher_or_superadmin"
on public.score_entries
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "score_entries_insert_teacher_or_superadmin" on public.score_entries;
create policy "score_entries_insert_teacher_or_superadmin"
on public.score_entries
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "score_entries_update_teacher_or_superadmin" on public.score_entries;
create policy "score_entries_update_teacher_or_superadmin"
on public.score_entries
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
