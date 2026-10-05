-- =============================================================================
-- Migration 0076: OMR Exam Bank & Multi-Device Synchronization
-- =============================================================================
-- Enables cloud storage for OMR answer sheets and answer keys.
-- Allows seamless cross-device synchronization (PC <-> Smartphone) so teachers
-- can design and print exams on their computer, and immediately scan and grade
-- on their smartphone camera without losing data.
-- =============================================================================

create table if not exists public.omr_exam_templates (
  id text primary key default ('bank_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6)),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  classroom_id uuid,
  title text not null,
  subject_name text not null,
  academic_year text default '2568',
  term text default '1',
  room_name text,
  school_name text,
  is_universal_room boolean not null default true,
  total_questions int not null default 20,
  choices_count int not null default 4,
  choice_label_type text not null default 'THAI',
  layout text not null default 'eco_half',
  student_id_format text not null default 'roll_number',
  total_score numeric not null default 20,
  theme_color text default 'slate',
  exam_set text default '01',
  exam_sets jsonb not null default '{}'::jsonb,
  answer_keys jsonb not null default '{}'::jsonb,
  points_per_question jsonb not null default '{}'::jsonb,
  is_shared_to_school boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_omr_exam_classroom_composite
    foreign key (classroom_id, workspace_id)
    references public.classrooms (id, workspace_id)
    on delete set null
);

create index if not exists idx_omr_exam_templates_workspace
  on public.omr_exam_templates (workspace_id, updated_at desc);

create index if not exists idx_omr_exam_templates_teacher
  on public.omr_exam_templates (teacher_id, updated_at desc);

-- Enable Row Level Security
alter table public.omr_exam_templates enable row level security;

-- Policy 1: Active workspace members can view their own exams or school-shared exams
drop policy if exists "Workspace members can view omr exam templates" on public.omr_exam_templates;
create policy "Workspace members can view omr exam templates"
  on public.omr_exam_templates
  for select
  using (
    (
      exists (
        select 1 from public.workspace_memberships wm
        where wm.workspace_id = omr_exam_templates.workspace_id
          and wm.user_id = auth.uid()
          and wm.status = 'active'
      )
      and (
        teacher_id = auth.uid()
        or is_shared_to_school = true
        or public.has_workspace_role(workspace_id, array['teacher_owner', 'admin'])
      )
    )
    or public.is_superadmin()
  );

-- Policy 2: Active workspace members can insert exam templates
drop policy if exists "Workspace members can insert omr exam templates" on public.omr_exam_templates;
create policy "Workspace members can insert omr exam templates"
  on public.omr_exam_templates
  for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = omr_exam_templates.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Policy 3: Author, workspace teacher_owner, admin or superadmin can update
drop policy if exists "Exam creator or workspace admin can update omr exam templates" on public.omr_exam_templates;
create policy "Exam creator or workspace admin can update omr exam templates"
  on public.omr_exam_templates
  for update
  using (
    teacher_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'admin'])
    or public.is_superadmin()
  );

-- Policy 4: Author, workspace teacher_owner, admin or superadmin can delete
drop policy if exists "Exam creator or workspace admin can delete omr exam templates" on public.omr_exam_templates;
create policy "Exam creator or workspace admin can delete omr exam templates"
  on public.omr_exam_templates
  for delete
  using (
    teacher_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'admin'])
    or public.is_superadmin()
  );

-- Auto-update updated_at timestamp
drop trigger if exists omr_exam_templates_touch_updated_at on public.omr_exam_templates;
create trigger omr_exam_templates_touch_updated_at
  before update on public.omr_exam_templates
  for each row execute function public.touch_updated_at();
