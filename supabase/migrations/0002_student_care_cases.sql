create table if not exists public.student_care_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  case_type text not null,
  risk_level text not null default 'watch'
    check (risk_level in ('normal', 'watch', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'monitoring', 'closed', 'archived')),
  summary text not null,
  sensitive_notes text,
  next_action text,
  assigned_to uuid references public.profiles(id) on delete set null,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_care_cases_workspace_student_idx
on public.student_care_cases (workspace_id, student_id, opened_at desc);

create index if not exists student_care_cases_workspace_status_idx
on public.student_care_cases (workspace_id, status, risk_level);

drop trigger if exists student_care_cases_touch_updated_at on public.student_care_cases;
create trigger student_care_cases_touch_updated_at
before update on public.student_care_cases
for each row execute function public.touch_updated_at();

alter table public.student_care_cases enable row level security;

drop policy if exists "student_care_cases_select_teacher_or_superadmin" on public.student_care_cases;
create policy "student_care_cases_select_teacher_or_superadmin"
on public.student_care_cases
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "student_care_cases_insert_teacher_or_superadmin" on public.student_care_cases;
create policy "student_care_cases_insert_teacher_or_superadmin"
on public.student_care_cases
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "student_care_cases_update_owner_teacher_or_superadmin" on public.student_care_cases;
create policy "student_care_cases_update_owner_teacher_or_superadmin"
on public.student_care_cases
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or (
    public.has_workspace_role(workspace_id, array['teacher_member'])
    and (assigned_to = auth.uid() or opened_by = auth.uid())
  )
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or (
    public.has_workspace_role(workspace_id, array['teacher_member'])
    and (assigned_to = auth.uid() or opened_by = auth.uid())
  )
);
