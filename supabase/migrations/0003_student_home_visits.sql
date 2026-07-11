create table if not exists public.student_home_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text,
  term text,
  form_code text not null default 'gsf_01',
  form_version text not null default '2569-03-06',
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'submitted', 'certified', 'archived')),
  form_data jsonb not null default '{}',
  completion_percent integer not null default 0
    check (completion_percent >= 0 and completion_percent <= 100),
  household_member_count integer
    check (household_member_count is null or household_member_count >= 0),
  household_income_monthly numeric(12,2)
    check (household_income_monthly is null or household_income_monthly >= 0),
  address_text text,
  travel_method text,
  distance_km numeric(8,2)
    check (distance_km is null or distance_km >= 0),
  photo_status text not null default 'pending'
    check (photo_status in ('pending', 'partial', 'complete', 'exempted')),
  consent_accepted boolean not null default false,
  visited_at date,
  visited_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  certified_by uuid references public.profiles(id) on delete set null,
  certified_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_home_visits_unique_student_term_idx
on public.student_home_visits (workspace_id, student_id, academic_year, term)
where status <> 'archived';

create index if not exists student_home_visits_workspace_student_idx
on public.student_home_visits (workspace_id, student_id, updated_at desc);

create index if not exists student_home_visits_workspace_status_idx
on public.student_home_visits (workspace_id, status, completion_percent desc);

drop trigger if exists student_home_visits_touch_updated_at on public.student_home_visits;
create trigger student_home_visits_touch_updated_at
before update on public.student_home_visits
for each row execute function public.touch_updated_at();

alter table public.student_home_visits enable row level security;

drop policy if exists "student_home_visits_select_teacher_or_superadmin" on public.student_home_visits;
create policy "student_home_visits_select_teacher_or_superadmin"
on public.student_home_visits
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "student_home_visits_insert_teacher_or_superadmin" on public.student_home_visits;
create policy "student_home_visits_insert_teacher_or_superadmin"
on public.student_home_visits
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "student_home_visits_update_teacher_or_superadmin" on public.student_home_visits;
create policy "student_home_visits_update_teacher_or_superadmin"
on public.student_home_visits
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
