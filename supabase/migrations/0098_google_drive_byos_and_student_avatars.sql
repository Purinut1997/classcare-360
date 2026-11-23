-- Google Drive BYOS (Workspace-level Storage + Cold Storage Migration + Student Avatars & Evidence Vault)
-- Strictly additive & multi-tenant safe (Expand-and-Contract compliant).

-- 1. Ensure composite (id, workspace_id) unique keys exist for composite FK integrity
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_files_id_workspace_key'
      and conrelid = 'public.app_files'::regclass
  ) then
    alter table public.app_files
      add constraint app_files_id_workspace_key unique (id, workspace_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_id_workspace_key'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_id_workspace_key unique (id, workspace_id);
  end if;
end $$;

-- 2. Expand public.app_files to support dual storage providers (Supabase Storage & Google Drive)
alter table public.app_files
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists external_file_id text,
  add column if not exists external_folder_id text,
  add column if not exists external_web_view_link text,
  add column if not exists folder_category text,
  add column if not exists thumbnail_file_id uuid references public.app_files(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_files_storage_provider_check'
      and conrelid = 'public.app_files'::regclass
  ) then
    alter table public.app_files
      add constraint app_files_storage_provider_check
      check (storage_provider in ('supabase', 'google_drive'));
  end if;
end $$;

create index if not exists app_files_workspace_provider_idx
  on public.app_files (workspace_id, storage_provider, created_at desc)
  where deleted_at is null;

create index if not exists app_files_external_file_id_idx
  on public.app_files (external_file_id)
  where external_file_id is not null;

drop policy if exists "app_files_update_workspace_member" on public.app_files;
create policy "app_files_update_workspace_member"
on public.app_files
for update
to authenticated
using (
  public.is_superadmin()
  or owner_profile_id = auth.uid()
  or (
    workspace_id is not null
    and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
)
with check (
  public.is_superadmin()
  or owner_profile_id = auth.uid()
  or (
    workspace_id is not null
    and public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  )
);

-- 3. Expand public.students with nullable avatar_file_id (composite FK locked to workspace_id)
alter table public.students
  add column if not exists avatar_file_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_avatar_file_workspace_fkey'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_avatar_file_workspace_fkey
      foreign key (avatar_file_id, workspace_id)
      references public.app_files (id, workspace_id)
      on delete set null (avatar_file_id);
  end if;
end $$;

-- 4. Expand public.daily_brief_attachments with optional file_id (composite FK locked to workspace_id)
do $$
begin
  if to_regclass('public.daily_brief_attachments') is not null then
    alter table public.daily_brief_attachments
      add column if not exists file_id uuid;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'daily_brief_attachments_file_workspace_fkey'
        and conrelid = 'public.daily_brief_attachments'::regclass
    ) then
      alter table public.daily_brief_attachments
        add constraint daily_brief_attachments_file_workspace_fkey
        foreign key (file_id, workspace_id)
        references public.app_files (id, workspace_id)
        on delete set null (file_id);
    end if;
  end if;
end $$;

-- 5. Workspace Google Drive Connection Metadata (non-secret status & folder directory)
create table if not exists public.workspace_drive_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  connected_by_profile_id uuid references public.profiles(id) on delete set null,
  google_email text,
  google_user_id text,
  root_folder_id text,
  root_folder_name text,
  subfolders_json jsonb not null default '{}'::jsonb,
  storage_quota_json jsonb not null default '{}'::jsonb,
  auto_route_uploads boolean not null default true,
  auto_backup_enabled boolean not null default false,
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'reauth_required', 'error')),
  last_error text,
  last_synced_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_drive_connections enable row level security;

drop policy if exists "workspace_drive_connections_select_member" on public.workspace_drive_connections;
create policy "workspace_drive_connections_select_member"
on public.workspace_drive_connections
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "workspace_drive_connections_insert_owner" on public.workspace_drive_connections;
create policy "workspace_drive_connections_insert_owner"
on public.workspace_drive_connections
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

drop policy if exists "workspace_drive_connections_update_owner" on public.workspace_drive_connections;
create policy "workspace_drive_connections_update_owner"
on public.workspace_drive_connections
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

drop policy if exists "workspace_drive_connections_delete_owner" on public.workspace_drive_connections;
create policy "workspace_drive_connections_delete_owner"
on public.workspace_drive_connections
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

-- 6. Encrypted OAuth Refresh Token Vault (Service-Role Edge Function access only; zero client RLS policies)
create table if not exists public.workspace_drive_tokens (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  encrypted_refresh_token text not null,
  token_scope text not null default 'https://www.googleapis.com/auth/drive.file',
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_drive_tokens enable row level security;

-- 7. Unified Multi-Module Evidence Vault (leave notes, behavior certificates, OMR scans, health & savings docs)
create table if not exists public.student_evidence_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid,
  file_id uuid not null,
  module_key text not null
    check (module_key in (
      'student_avatar',
      'home_visit',
      'attendance_leave',
      'behavior_portfolio',
      'omr_score_scan',
      'daily_brief',
      'health_doc',
      'savings_slip',
      'official_document',
      'workspace_backup'
    )),
  entity_id text,
  title text not null default '',
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint student_evidence_files_file_workspace_fkey
    foreign key (file_id, workspace_id)
    references public.app_files (id, workspace_id)
    on delete cascade,
  constraint student_evidence_files_student_workspace_fkey
    foreign key (student_id, workspace_id)
    references public.students (id, workspace_id)
    on delete cascade
);

create index if not exists student_evidence_files_lookup_idx
  on public.student_evidence_files (workspace_id, module_key, student_id, created_at desc)
  where deleted_at is null;

alter table public.student_evidence_files enable row level security;

drop policy if exists "student_evidence_files_select_member" on public.student_evidence_files;
create policy "student_evidence_files_select_member"
on public.student_evidence_files
for select
to authenticated
using (
  public.is_superadmin()
  or public.is_workspace_member(workspace_id)
);

drop policy if exists "student_evidence_files_insert_teacher" on public.student_evidence_files;
create policy "student_evidence_files_insert_teacher"
on public.student_evidence_files
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "student_evidence_files_update_teacher" on public.student_evidence_files;
create policy "student_evidence_files_update_teacher"
on public.student_evidence_files
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

drop policy if exists "student_evidence_files_delete_teacher" on public.student_evidence_files;
create policy "student_evidence_files_delete_teacher"
on public.student_evidence_files
for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

-- 8. Ensure Supabase fallback buckets exist with WebP + document support & workspace RLS
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'student-avatars',
  'student-avatars',
  false,
  5242880,
  array[
    'image/webp',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'evidence-files',
  'evidence-files',
  false,
  20971520,
  array[
    'image/webp',
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/json'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "student_avatars_storage_select_member" on storage.objects;
create policy "student_avatars_storage_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-avatars'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_workspace_member(split_part(name, '/', 1)::uuid)
      else false
    end
  )
);

drop policy if exists "student_avatars_storage_insert_teacher" on storage.objects;
create policy "student_avatars_storage_insert_teacher"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-avatars'
  and owner = auth.uid()
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (
      public.is_superadmin()
      or public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member'])
    )
    else false
  end
);

drop policy if exists "student_avatars_storage_delete_teacher" on storage.objects;
create policy "student_avatars_storage_delete_teacher"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-avatars'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner'])
      else false
    end
  )
);

drop policy if exists "evidence_files_storage_select_member" on storage.objects;
create policy "evidence_files_storage_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'evidence-files'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_workspace_member(split_part(name, '/', 1)::uuid)
      else false
    end
  )
);

drop policy if exists "evidence_files_storage_insert_teacher" on storage.objects;
create policy "evidence_files_storage_insert_teacher"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'evidence-files'
  and owner = auth.uid()
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (
      public.is_superadmin()
      or public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member'])
    )
    else false
  end
);

drop policy if exists "evidence_files_storage_delete_teacher" on storage.objects;
create policy "evidence_files_storage_delete_teacher"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'evidence-files'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member'])
      else false
    end
  )
);
