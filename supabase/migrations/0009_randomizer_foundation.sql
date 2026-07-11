-- ClassCare 360 - Classroom Randomizer foundation.

create table if not exists public.randomizer_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  mode text not null default 'single'
    check (mode in ('single', 'groups', 'order')),
  result jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists randomizer_sessions_workspace_classroom_idx
on public.randomizer_sessions (workspace_id, classroom_id, created_at desc);

drop trigger if exists randomizer_sessions_touch_updated_at on public.randomizer_sessions;
create trigger randomizer_sessions_touch_updated_at
before update on public.randomizer_sessions
for each row execute function public.touch_updated_at();

alter table public.randomizer_sessions enable row level security;

drop policy if exists "randomizer_sessions_select_teacher_or_superadmin" on public.randomizer_sessions;
create policy "randomizer_sessions_select_teacher_or_superadmin"
on public.randomizer_sessions
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "randomizer_sessions_insert_teacher_or_superadmin" on public.randomizer_sessions;
create policy "randomizer_sessions_insert_teacher_or_superadmin"
on public.randomizer_sessions
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "randomizer_sessions_update_teacher_or_superadmin" on public.randomizer_sessions;
create policy "randomizer_sessions_update_teacher_or_superadmin"
on public.randomizer_sessions
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
