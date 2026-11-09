-- Per-teacher notification choices, isolated by workspace and authenticated profile.
create table if not exists public.teacher_notification_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, profile_id),
  constraint teacher_notification_preferences_membership_fk
    foreign key (workspace_id, profile_id)
    references public.workspace_memberships (workspace_id, profile_id)
    on delete cascade
);

create index if not exists teacher_notification_preferences_profile_idx
  on public.teacher_notification_preferences (profile_id, workspace_id);

alter table public.teacher_notification_preferences enable row level security;

create policy "teachers_read_own_notification_preferences"
on public.teacher_notification_preferences
for select
to authenticated
using (
  profile_id = auth.uid()
  and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "teachers_create_own_notification_preferences"
on public.teacher_notification_preferences
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "teachers_update_own_notification_preferences"
on public.teacher_notification_preferences
for update
to authenticated
using (
  profile_id = auth.uid()
  and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  profile_id = auth.uid()
  and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);
