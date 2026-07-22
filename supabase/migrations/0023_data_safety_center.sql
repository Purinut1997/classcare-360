-- Data Safety Center foundation
-- Supports import audit rows, recoverable trash, data health checks,
-- school calendar/report settings, and reusable parent message templates.

create table if not exists public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  entity_type text not null
    check (entity_type in ('student', 'guardian', 'classroom', 'attendance', 'score', 'savings')),
  source_key text,
  raw_data jsonb not null default '{}',
  normalized_data jsonb not null default '{}',
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'valid', 'warning', 'invalid', 'duplicate', 'imported', 'skipped')),
  validation_messages jsonb not null default '[]',
  matched_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_job_id, row_number)
);

create table if not exists public.trash_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  display_name text not null,
  reason text,
  payload jsonb not null default '{}',
  restore_status text not null default 'restorable'
    check (restore_status in ('restorable', 'restored', 'expired', 'purged', 'blocked')),
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default now(),
  restored_by uuid references public.profiles(id) on delete set null,
  restored_at timestamptz,
  purged_by uuid references public.profiles(id) on delete set null,
  purged_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_health_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  issue_key text not null,
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'error', 'critical')),
  issue_type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  detail text,
  suggested_action text,
  status text not null default 'open'
    check (status in ('open', 'ignored', 'resolved')),
  detected_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, issue_key, status)
);

create table if not exists public.school_calendar_days (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  calendar_date date not null,
  day_type text not null default 'school_day'
    check (day_type in ('school_day', 'holiday', 'exam', 'activity', 'makeup', 'closed')),
  title text not null,
  affects_attendance boolean not null default true,
  affects_reports boolean not null default true,
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, calendar_date, title)
);

create table if not exists public.workspace_ui_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  mode text not null default 'simple'
    check (mode in ('simple', 'advanced')),
  enabled_modules jsonb not null default '{}',
  parent_visible_fields jsonb not null default '{}',
  report_defaults jsonb not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_type text not null
    check (template_type in ('attendance_absent', 'attendance_late', 'care_follow_up', 'savings', 'score', 'general')),
  title text not null,
  body text not null,
  channel text not null default 'line'
    check (channel in ('line', 'sms', 'email', 'print')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_job_rows_workspace_idx
  on public.import_job_rows (workspace_id, validation_status, entity_type);
create index if not exists import_job_rows_job_idx
  on public.import_job_rows (import_job_id, row_number);
create index if not exists trash_items_workspace_idx
  on public.trash_items (workspace_id, restore_status, deleted_at desc);
create index if not exists data_health_issues_workspace_idx
  on public.data_health_issues (workspace_id, status, severity);
create index if not exists school_calendar_days_workspace_idx
  on public.school_calendar_days (workspace_id, calendar_date);
create index if not exists message_templates_workspace_idx
  on public.message_templates (workspace_id, template_type, is_active);

alter table public.import_job_rows enable row level security;
alter table public.trash_items enable row level security;
alter table public.data_health_issues enable row level security;
alter table public.school_calendar_days enable row level security;
alter table public.workspace_ui_settings enable row level security;
alter table public.message_templates enable row level security;

drop trigger if exists import_job_rows_touch_updated_at on public.import_job_rows;
create trigger import_job_rows_touch_updated_at
before update on public.import_job_rows
for each row execute function public.touch_updated_at();

drop trigger if exists trash_items_touch_updated_at on public.trash_items;
create trigger trash_items_touch_updated_at
before update on public.trash_items
for each row execute function public.touch_updated_at();

drop trigger if exists data_health_issues_touch_updated_at on public.data_health_issues;
create trigger data_health_issues_touch_updated_at
before update on public.data_health_issues
for each row execute function public.touch_updated_at();

drop trigger if exists school_calendar_days_touch_updated_at on public.school_calendar_days;
create trigger school_calendar_days_touch_updated_at
before update on public.school_calendar_days
for each row execute function public.touch_updated_at();

drop trigger if exists workspace_ui_settings_touch_updated_at on public.workspace_ui_settings;
create trigger workspace_ui_settings_touch_updated_at
before update on public.workspace_ui_settings
for each row execute function public.touch_updated_at();

drop trigger if exists message_templates_touch_updated_at on public.message_templates;
create trigger message_templates_touch_updated_at
before update on public.message_templates
for each row execute function public.touch_updated_at();

drop policy if exists "import_job_rows_select_teacher_or_superadmin" on public.import_job_rows;
create policy "import_job_rows_select_teacher_or_superadmin"
on public.import_job_rows
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "import_job_rows_write_teacher_or_superadmin" on public.import_job_rows;
create policy "import_job_rows_write_teacher_or_superadmin"
on public.import_job_rows
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "trash_items_select_owner_or_superadmin" on public.trash_items;
create policy "trash_items_select_owner_or_superadmin"
on public.trash_items
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or deleted_by = auth.uid()
);

drop policy if exists "trash_items_write_owner_or_superadmin" on public.trash_items;
create policy "trash_items_write_owner_or_superadmin"
on public.trash_items
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or deleted_by = auth.uid()
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or deleted_by = auth.uid()
);

drop policy if exists "data_health_issues_select_teacher_or_superadmin" on public.data_health_issues;
create policy "data_health_issues_select_teacher_or_superadmin"
on public.data_health_issues
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "data_health_issues_write_owner_or_superadmin" on public.data_health_issues;
create policy "data_health_issues_write_owner_or_superadmin"
on public.data_health_issues
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

drop policy if exists "school_calendar_days_select_teacher_or_superadmin" on public.school_calendar_days;
create policy "school_calendar_days_select_teacher_or_superadmin"
on public.school_calendar_days
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "school_calendar_days_write_owner_or_superadmin" on public.school_calendar_days;
create policy "school_calendar_days_write_owner_or_superadmin"
on public.school_calendar_days
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

drop policy if exists "workspace_ui_settings_select_teacher_or_superadmin" on public.workspace_ui_settings;
create policy "workspace_ui_settings_select_teacher_or_superadmin"
on public.workspace_ui_settings
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "workspace_ui_settings_write_owner_or_superadmin" on public.workspace_ui_settings;
create policy "workspace_ui_settings_write_owner_or_superadmin"
on public.workspace_ui_settings
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

drop policy if exists "message_templates_select_teacher_or_superadmin" on public.message_templates;
create policy "message_templates_select_teacher_or_superadmin"
on public.message_templates
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "message_templates_write_owner_or_superadmin" on public.message_templates;
create policy "message_templates_write_owner_or_superadmin"
on public.message_templates
for all
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);
