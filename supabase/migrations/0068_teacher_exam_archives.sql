-- 0068_teacher_exam_archives.sql
-- Table to store teacher created exam sets, capped at 10 most recent per workspace (FIFO)

create table if not exists public.teacher_exams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  title text not null,
  subject text not null,
  grade_level text not null,
  term text default '1',
  academic_year text default '2568',
  exam_type text not null default 'midterm', -- 'midterm' | 'final' | 'quiz'
  total_score numeric not null default 20,
  multiple_choice_count int not null default 0,
  subjective_count int not null default 0,
  indicator_summary text,
  exam_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookup of recent exams
create index if not exists idx_teacher_exams_workspace_created
  on public.teacher_exams(workspace_id, created_at desc);

create index if not exists idx_teacher_exams_teacher_created
  on public.teacher_exams(teacher_id, created_at desc);

-- RLS
alter table public.teacher_exams enable row level security;

-- Policy: Workspace members can view teacher exams
create policy "Workspace members can view teacher exams"
  on public.teacher_exams
  for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = teacher_exams.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Policy: Workspace members can insert teacher exams
create policy "Workspace members can insert teacher exams"
  on public.teacher_exams
  for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = teacher_exams.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Policy: Creator or Workspace Admin/Owner can update or delete
create policy "Exam creator or workspace admin can update"
  on public.teacher_exams
  for update
  using (
    teacher_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'admin'])
    or public.is_superadmin()
  );

create policy "Exam creator or workspace admin can delete"
  on public.teacher_exams
  for delete
  using (
    teacher_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'admin'])
    or public.is_superadmin()
  );

-- Trigger Function: Enforce maximum 10 recent exams per workspace (FIFO auto-trim)
create or replace function public.trim_teacher_exams_quota()
returns trigger
language plpgsql
security definer
as $$
declare
  excess_ids uuid[];
begin
  select array_agg(id) into excess_ids
  from (
    select id
    from public.teacher_exams
    where workspace_id = new.workspace_id
    order by created_at desc
    offset 10
  ) old_exams;

  if excess_ids is not null and array_length(excess_ids, 1) > 0 then
    delete from public.teacher_exams
    where id = any(excess_ids);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trim_teacher_exams_quota on public.teacher_exams;
create trigger trg_trim_teacher_exams_quota
  after insert on public.teacher_exams
  for each row
  execute function public.trim_teacher_exams_quota();
