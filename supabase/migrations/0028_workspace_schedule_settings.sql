-- Shared timetable and subject catalogue for each workspace.

create table if not exists public.workspace_schedule_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_schedule_settings enable row level security;

drop trigger if exists workspace_schedule_settings_touch_updated_at on public.workspace_schedule_settings;
create trigger workspace_schedule_settings_touch_updated_at
before update on public.workspace_schedule_settings
for each row execute function public.touch_updated_at();

drop policy if exists "workspace_schedule_settings_select_teacher_or_superadmin" on public.workspace_schedule_settings;
create policy "workspace_schedule_settings_select_teacher_or_superadmin"
on public.workspace_schedule_settings
for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "workspace_schedule_settings_write_owner_or_superadmin" on public.workspace_schedule_settings;
create policy "workspace_schedule_settings_write_owner_or_superadmin"
on public.workspace_schedule_settings
for all to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);
