-- ClassCare 360 core foundation
-- Phase 2 initial migration draft

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  phone text,
  avatar_url text,
  account_status text not null default 'registered'
    check (account_status in ('registered', 'pending_approval', 'trial', 'active', 'expired', 'suspended', 'cancelled')),
  referral_code text unique,
  referred_by_profile_id uuid references public.profiles(id),
  first_login_at timestamptz,
  last_login_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.superadmin_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  level text not null default 'superadmin',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_name text,
  school_code text,
  owner_profile_id uuid not null references public.profiles(id),
  academic_year text,
  timezone text not null default 'Asia/Bangkok',
  school_lat numeric(10,7),
  school_lng numeric(10,7),
  school_location_updated_at timestamptz,
  logo_file_id uuid,
  settings jsonb not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null
    check (role in ('teacher_owner', 'teacher_member', 'parent', 'student', 'viewer')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'removed')),
  classroom_scope uuid[],
  subject_scope uuid[],
  permissions jsonb not null default '{}',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_thb integer not null default 0 check (price_thb >= 0),
  duration_days integer check (duration_days is null or duration_days > 0),
  is_active boolean not null default true,
  features jsonb not null default '{}',
  limits jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  module_key text not null,
  is_enabled boolean not null default true,
  limits jsonb not null default '{}',
  unique (plan_id, module_key)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.plans(id),
  status text not null
    check (status in ('trial', 'active', 'expired', 'suspended', 'cancelled', 'refunded')),
  starts_at timestamptz,
  ends_at timestamptz,
  trial_used boolean not null default false,
  source text,
  payment_request_id uuid,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  grade_level text,
  academic_year text,
  homeroom_teacher_profile_id uuid references public.profiles(id),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, academic_year)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  student_code text,
  first_name text not null,
  last_name text not null,
  nickname text,
  gender text check (gender in ('male', 'female', 'other', 'unspecified')),
  birth_date date,
  status text not null default 'active'
    check (status in ('active', 'transferred', 'graduated', 'inactive', 'archived')),
  enrolled_at date,
  care_flags jsonb not null default '{}',
  health_flags jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_code)
);

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  relation text not null,
  display_name text not null,
  phone text,
  line_user_id text,
  is_primary boolean not null default false,
  consent_status text not null default 'pending'
    check (consent_status in ('pending', 'granted', 'revoked')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profile_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'removed')),
  linked_by uuid references public.profiles(id),
  linked_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id),
  unique (workspace_id, profile_id)
);

create table if not exists public.portal_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  portal_role text not null check (portal_role in ('parent', 'student')),
  invite_email text not null,
  relation text,
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  attendance_date date not null,
  period_label text not null default 'เช้า',
  subject_name text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'locked', 'archived')),
  created_by uuid not null references public.profiles(id),
  submitted_at timestamptz,
  locked_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, attendance_date, period_label)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'present'
    check (status in ('present', 'absent', 'late', 'leave', 'sick', 'activity')),
  note text,
  checked_by uuid references public.profiles(id),
  checked_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.app_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  original_filename text,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum text,
  privacy_level text not null default 'private'
    check (privacy_level in ('public', 'private', 'restricted', 'sensitive')),
  owner_profile_id uuid references public.profiles(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  import_type text not null
    check (import_type in ('students', 'guardians', 'attendance', 'scores', 'savings')),
  source_file_id uuid references public.app_files(id),
  status text not null default 'preview'
    check (status in ('preview', 'imported', 'failed', 'cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  preview jsonb not null default '[]',
  error_summary jsonb not null default '[]',
  created_by uuid not null references public.profiles(id),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_backups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  backup_type text not null default 'manual'
    check (backup_type in ('manual', 'scheduled', 'teacher_self')),
  status text not null default 'created'
    check (status in ('created', 'uploaded', 'failed', 'restored', 'archived')),
  file_id uuid references public.app_files(id),
  row_counts jsonb not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces
  add constraint workspaces_logo_file_id_fkey
  foreign key (logo_file_id) references public.app_files(id);

create table if not exists public.payment_qr_codes (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  file_id uuid not null references public.app_files(id),
  bank_name text,
  account_name text,
  account_hint text,
  is_active boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.plans(id),
  qr_code_id uuid references public.payment_qr_codes(id),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'cancelled', 'refunded', 'expired')),
  base_amount_thb integer not null check (base_amount_thb >= 0),
  credit_amount_thb integer not null default 0 check (credit_amount_thb >= 0),
  payable_amount_thb integer not null check (payable_amount_thb >= 0),
  slip_file_id uuid references public.app_files(id),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add constraint subscriptions_payment_request_id_fkey
  foreign key (payment_request_id) references public.payment_requests(id);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  payment_request_id uuid not null references public.payment_requests(id),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'cancelled', 'paid_back')),
  reason text not null,
  refund_channel jsonb not null default '{}',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  paid_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_profile_id uuid not null references public.profiles(id),
  referred_profile_id uuid not null references public.profiles(id),
  payment_request_id uuid references public.payment_requests(id),
  status text not null
    check (status in ('pending', 'qualified', 'reversed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (referrer_profile_id, referred_profile_id)
);

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  source_referral_event_id uuid references public.referral_events(id),
  amount_thb integer not null check (amount_thb <> 0),
  status text not null
    check (status in ('pending', 'available', 'used', 'reversed', 'expired')),
  used_payment_request_id uuid references public.payment_requests(id),
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  privacy_level text not null default 'normal'
    check (privacy_level in ('normal', 'restricted', 'sensitive')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  channel text not null
    check (channel in ('in_app', 'telegram', 'line')),
  status text not null
    check (status in ('queued', 'sent', 'skipped', 'failed')),
  provider_message_id text,
  error_message text,
  response_metadata jsonb not null default '{}',
  dispatched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  entity_table text,
  entity_id uuid,
  risk_level text not null default 'normal'
    check (risk_level in ('low', 'normal', 'high', 'critical')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.edit_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  table_name text not null,
  record_id uuid not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  operation text not null check (operation in ('insert', 'update', 'delete')),
  old_values jsonb,
  new_values jsonb
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_referral_code_idx on public.profiles (referral_code);
create index if not exists workspaces_owner_profile_id_idx on public.workspaces (owner_profile_id);
create index if not exists workspace_memberships_workspace_id_idx on public.workspace_memberships (workspace_id);
create index if not exists workspace_memberships_profile_id_idx on public.workspace_memberships (profile_id);
create index if not exists subscriptions_workspace_status_idx on public.subscriptions (workspace_id, status);
create index if not exists subscriptions_profile_id_idx on public.subscriptions (profile_id);
create index if not exists app_files_workspace_idx on public.app_files (workspace_id, created_at desc);
create index if not exists import_jobs_workspace_created_idx on public.import_jobs (workspace_id, created_at desc);
create index if not exists workspace_backups_workspace_created_idx on public.workspace_backups (workspace_id, created_at desc);
create index if not exists student_profile_links_profile_idx on public.student_profile_links (profile_id, status);
create index if not exists student_profile_links_student_idx on public.student_profile_links (student_id, status);
create index if not exists portal_invitations_workspace_status_idx on public.portal_invitations (workspace_id, status, created_at desc);
create index if not exists portal_invitations_student_idx on public.portal_invitations (student_id, portal_role, status);
create index if not exists portal_invitations_email_idx on public.portal_invitations (lower(invite_email), status);
create index if not exists payment_requests_workspace_status_idx on public.payment_requests (workspace_id, status);
create index if not exists refund_requests_workspace_status_idx on public.refund_requests (workspace_id, status);
create index if not exists notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index if not exists notification_dispatch_logs_notification_idx on public.notification_dispatch_logs (notification_id, created_at desc);
create index if not exists notification_dispatch_logs_workspace_idx on public.notification_dispatch_logs (workspace_id, created_at desc);
create index if not exists audit_logs_workspace_created_idx on public.audit_logs (workspace_id, created_at desc);
create index if not exists edit_history_record_idx on public.edit_history (table_name, record_id, changed_at desc);

create unique index if not exists subscriptions_one_active_per_workspace_idx
  on public.subscriptions (workspace_id)
  where status in ('trial', 'active');

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

create trigger workspace_memberships_touch_updated_at
before update on public.workspace_memberships
for each row execute function public.touch_updated_at();

create trigger plans_touch_updated_at
before update on public.plans
for each row execute function public.touch_updated_at();

create trigger subscriptions_touch_updated_at
before update on public.subscriptions
for each row execute function public.touch_updated_at();

create trigger payment_qr_codes_touch_updated_at
before update on public.payment_qr_codes
for each row execute function public.touch_updated_at();

create trigger payment_requests_touch_updated_at
before update on public.payment_requests
for each row execute function public.touch_updated_at();

create trigger refund_requests_touch_updated_at
before update on public.refund_requests
for each row execute function public.touch_updated_at();

create trigger referral_credits_touch_updated_at
before update on public.referral_credits
for each row execute function public.touch_updated_at();

create trigger classrooms_touch_updated_at
before update on public.classrooms
for each row execute function public.touch_updated_at();

create trigger students_touch_updated_at
before update on public.students
for each row execute function public.touch_updated_at();

create trigger student_guardians_touch_updated_at
before update on public.student_guardians
for each row execute function public.touch_updated_at();

create trigger student_profile_links_touch_updated_at
before update on public.student_profile_links
for each row execute function public.touch_updated_at();

create trigger portal_invitations_touch_updated_at
before update on public.portal_invitations
for each row execute function public.touch_updated_at();

create trigger attendance_sessions_touch_updated_at
before update on public.attendance_sessions
for each row execute function public.touch_updated_at();

create trigger attendance_records_touch_updated_at
before update on public.attendance_records
for each row execute function public.touch_updated_at();

create trigger import_jobs_touch_updated_at
before update on public.import_jobs
for each row execute function public.touch_updated_at();

create trigger workspace_backups_touch_updated_at
before update on public.workspace_backups
for each row execute function public.touch_updated_at();

create or replace function public.auth_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.superadmin_profiles sp
    where sp.profile_id = auth.uid()
      and sp.is_active = true
  );
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.owns_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_profile_id = auth.uid()
      and w.archived_at is null
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

create or replace function public.has_active_subscription(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.workspace_id = target_workspace_id
      and s.status in ('trial', 'active')
      and (s.starts_at is null or s.starts_at <= now())
      and (s.ends_at is null or s.ends_at > now())
      and p.code in ('TRIAL_30', 'VIP_YEARLY')
  );
$$;

create or replace function public.can_use_module(
  target_workspace_id uuid,
  target_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.module_entitlements me on me.plan_id = s.plan_id
    where s.workspace_id = target_workspace_id
      and s.status in ('trial', 'active')
      and (s.ends_at is null or s.ends_at > now())
      and me.module_key = target_module_key
      and me.is_enabled = true
  );
$$;

create or replace function public.workspace_has_subscription(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.workspace_id = target_workspace_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.superadmin_profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.plans enable row level security;
alter table public.module_entitlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_profile_links enable row level security;
alter table public.portal_invitations enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.app_files enable row level security;
alter table public.import_jobs enable row level security;
alter table public.workspace_backups enable row level security;
alter table public.payment_qr_codes enable row level security;
alter table public.payment_requests enable row level security;
alter table public.refund_requests enable row level security;
alter table public.referral_events enable row level security;
alter table public.referral_credits enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_dispatch_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.edit_history enable row level security;

create policy "profiles_select_self_or_superadmin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_superadmin());

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "superadmin_profiles_select_superadmin"
on public.superadmin_profiles
for select
to authenticated
using (public.is_superadmin());

create policy "workspaces_select_member_or_superadmin"
on public.workspaces
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(id)
  or owner_profile_id = auth.uid()
);

create policy "workspaces_insert_owner"
on public.workspaces
for insert
to authenticated
with check (owner_profile_id = auth.uid());

create policy "workspaces_update_owner_or_superadmin"
on public.workspaces
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(id, array['teacher_owner'])
);

create policy "workspace_memberships_select_self_owner_or_superadmin"
on public.workspace_memberships
for select
to authenticated
using (
  public.is_superadmin()
  or profile_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "workspace_memberships_insert_owner_or_superadmin"
on public.workspace_memberships
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or (
    profile_id = auth.uid()
    and role = 'teacher_owner'
    and status = 'active'
    and public.owns_workspace(workspace_id)
  )
);

create policy "workspace_memberships_update_owner_or_superadmin"
on public.workspace_memberships
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "plans_select_authenticated"
on public.plans
for select
to authenticated
using (is_active = true or public.is_superadmin());

create policy "plans_write_superadmin"
on public.plans
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "module_entitlements_select_authenticated"
on public.module_entitlements
for select
to authenticated
using (true);

create policy "module_entitlements_write_superadmin"
on public.module_entitlements
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "subscriptions_select_workspace_or_superadmin"
on public.subscriptions
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);

create policy "subscriptions_insert_initial_trial_owner"
on public.subscriptions
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and status = 'trial'
  and source = 'onboarding'
  and public.owns_workspace(workspace_id)
  and exists (
    select 1
    from public.plans p
    where p.id = plan_id
      and p.code = 'TRIAL_30'
      and p.is_active = true
  )
  and not public.workspace_has_subscription(workspace_id)
);

create policy "subscriptions_write_superadmin"
on public.subscriptions
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "classrooms_select_workspace_or_superadmin"
on public.classrooms
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);

create policy "classrooms_insert_teacher_or_superadmin"
on public.classrooms
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "classrooms_update_owner_or_superadmin"
on public.classrooms
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "students_select_workspace_or_linked_guardian"
on public.students
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
  or exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = students.id
      and sg.profile_id = auth.uid()
      and sg.workspace_id = students.workspace_id
      and sg.consent_status = 'granted'
  )
  or exists (
    select 1
    from public.student_profile_links spl
    where spl.student_id = students.id
      and spl.profile_id = auth.uid()
      and spl.workspace_id = students.workspace_id
      and spl.status = 'active'
  )
);

create policy "students_insert_teacher_or_superadmin"
on public.students
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "students_update_teacher_or_superadmin"
on public.students
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

create policy "student_guardians_select_teacher_self_or_superadmin"
on public.student_guardians
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  or profile_id = auth.uid()
);

create policy "student_guardians_insert_teacher_or_superadmin"
on public.student_guardians
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "student_guardians_update_teacher_or_superadmin"
on public.student_guardians
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

create policy "student_profile_links_select_teacher_self_or_superadmin"
on public.student_profile_links
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  or profile_id = auth.uid()
);

create policy "student_profile_links_insert_teacher_or_superadmin"
on public.student_profile_links
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "student_profile_links_update_teacher_or_superadmin"
on public.student_profile_links
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

create policy "portal_invitations_select_teacher_invitee_or_superadmin"
on public.portal_invitations
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  or accepted_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.email) = lower(invite_email)
  )
);

create policy "portal_invitations_insert_teacher_or_superadmin"
on public.portal_invitations
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

create policy "portal_invitations_update_teacher_or_superadmin"
on public.portal_invitations
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

create policy "attendance_sessions_select_workspace_or_superadmin"
on public.attendance_sessions
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
  or exists (
    select 1
    from public.attendance_records ar
    join public.student_guardians sg on sg.student_id = ar.student_id
    where ar.session_id = attendance_sessions.id
      and ar.workspace_id = attendance_sessions.workspace_id
      and sg.profile_id = auth.uid()
      and sg.workspace_id = attendance_sessions.workspace_id
      and sg.consent_status = 'granted'
  )
  or exists (
    select 1
    from public.attendance_records ar
    join public.student_profile_links spl on spl.student_id = ar.student_id
    where ar.session_id = attendance_sessions.id
      and ar.workspace_id = attendance_sessions.workspace_id
      and spl.profile_id = auth.uid()
      and spl.workspace_id = attendance_sessions.workspace_id
      and spl.status = 'active'
  )
);

create policy "attendance_sessions_insert_teacher_or_superadmin"
on public.attendance_sessions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);

create policy "attendance_sessions_update_teacher_or_superadmin"
on public.attendance_sessions
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

create policy "attendance_records_select_workspace_parent_student_or_superadmin"
on public.attendance_records
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
  or exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = attendance_records.student_id
      and sg.profile_id = auth.uid()
      and sg.workspace_id = attendance_records.workspace_id
      and sg.consent_status = 'granted'
  )
  or exists (
    select 1
    from public.student_profile_links spl
    where spl.student_id = attendance_records.student_id
      and spl.profile_id = auth.uid()
      and spl.workspace_id = attendance_records.workspace_id
      and spl.status = 'active'
  )
);

create policy "attendance_records_insert_teacher_or_superadmin"
on public.attendance_records
for insert
to authenticated
with check (
  checked_by = auth.uid()
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);

create policy "attendance_records_update_teacher_or_superadmin"
on public.attendance_records
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

create policy "app_files_select_workspace_owner_or_superadmin"
on public.app_files
for select
to authenticated
using (
  public.is_superadmin()
  or owner_profile_id = auth.uid()
  or (workspace_id is not null and public.is_workspace_member(workspace_id))
);

create policy "app_files_insert_workspace_member"
on public.app_files
for insert
to authenticated
with check (
  owner_profile_id = auth.uid()
  and (
    workspace_id is null
    or public.is_workspace_member(workspace_id)
  )
);

create policy "import_jobs_select_teacher_or_superadmin"
on public.import_jobs
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  or created_by = auth.uid()
);

create policy "import_jobs_insert_teacher_or_superadmin"
on public.import_jobs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);

create policy "import_jobs_update_teacher_owner_or_superadmin"
on public.import_jobs
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or created_by = auth.uid()
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or created_by = auth.uid()
);

create policy "workspace_backups_select_teacher_or_superadmin"
on public.workspace_backups
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  or requested_by = auth.uid()
);

create policy "workspace_backups_insert_teacher_or_superadmin"
on public.workspace_backups
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and (
    public.is_superadmin()
    or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);

create policy "workspace_backups_update_teacher_owner_or_superadmin"
on public.workspace_backups
for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or requested_by = auth.uid()
)
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or requested_by = auth.uid()
);

create policy "payment_qr_codes_select_active_or_superadmin"
on public.payment_qr_codes
for select
to authenticated
using (is_active = true or public.is_superadmin());

create policy "payment_qr_codes_write_superadmin"
on public.payment_qr_codes
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "payment_requests_select_workspace_or_superadmin"
on public.payment_requests
for select
to authenticated
using (
  public.is_superadmin()
  or profile_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "payment_requests_insert_owner"
on public.payment_requests
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "payment_requests_update_superadmin"
on public.payment_requests
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "refund_requests_select_workspace_or_superadmin"
on public.refund_requests
for select
to authenticated
using (
  public.is_superadmin()
  or profile_id = auth.uid()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "refund_requests_insert_owner"
on public.refund_requests
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create policy "refund_requests_update_superadmin"
on public.refund_requests
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "referral_events_select_self_or_superadmin"
on public.referral_events
for select
to authenticated
using (
  public.is_superadmin()
  or referrer_profile_id = auth.uid()
  or referred_profile_id = auth.uid()
);

create policy "referral_events_write_superadmin"
on public.referral_events
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "referral_credits_select_self_or_superadmin"
on public.referral_credits
for select
to authenticated
using (public.is_superadmin() or profile_id = auth.uid());

create policy "referral_credits_write_superadmin"
on public.referral_credits
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "notifications_select_self_or_superadmin"
on public.notifications
for select
to authenticated
using (
  public.is_superadmin()
  or profile_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['teacher_owner']))
);

create policy "notifications_update_read_self"
on public.notifications
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "notification_dispatch_logs_select_owner_or_superadmin"
on public.notification_dispatch_logs
for select
to authenticated
using (
  public.is_superadmin()
  or profile_id = auth.uid()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['teacher_owner']))
);

create policy "notification_dispatch_logs_insert_superadmin"
on public.notification_dispatch_logs
for insert
to authenticated
with check (public.is_superadmin());

create policy "notification_dispatch_logs_update_superadmin"
on public.notification_dispatch_logs
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "audit_logs_select_owner_or_superadmin"
on public.audit_logs
for select
to authenticated
using (
  public.is_superadmin()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['teacher_owner']))
);

create policy "audit_logs_insert_superadmin"
on public.audit_logs
for insert
to authenticated
with check (public.is_superadmin());

create policy "edit_history_select_owner_or_superadmin"
on public.edit_history
for select
to authenticated
using (
  public.is_superadmin()
  or (workspace_id is not null and public.has_workspace_role(workspace_id, array['teacher_owner']))
);
