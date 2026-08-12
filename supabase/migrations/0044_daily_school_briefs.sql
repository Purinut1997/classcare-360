-- Daily School Brief: one-day operational report, timeline and approval workflow.
create table if not exists public.daily_school_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  brief_date date not null,
  report_type text not null default 'daily' check (report_type in ('daily','activity','meeting','training','incident')),
  title text not null,
  summary text not null default '',
  highlights text not null default '',
  follow_ups text not null default '',
  tomorrow_plan text not null default '',
  auto_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','approved','returned','shared')),
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  approved_at timestamptz,
  shared_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, classroom_id, brief_date, report_type)
);

create table if not exists public.daily_brief_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brief_id uuid references public.daily_school_briefs(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  log_date date not null,
  log_time time not null default localtime,
  log_type text not null default 'quick' check (log_type in ('quick','note','event','issue','follow_up','system')),
  body text not null check (char_length(body) between 1 and 3000),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_brief_revisions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.daily_school_briefs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action text not null check (action in ('created','saved','submitted','approved','returned','shared')),
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_brief_attachments (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references public.daily_school_briefs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  log_id uuid references public.daily_brief_logs(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists daily_briefs_workspace_date_idx on public.daily_school_briefs(workspace_id,brief_date desc);
create index if not exists daily_brief_logs_workspace_date_idx on public.daily_brief_logs(workspace_id,log_date desc,log_time desc);
create index if not exists daily_brief_revisions_brief_idx on public.daily_brief_revisions(brief_id,created_at desc);
create unique index if not exists daily_briefs_scope_unique_idx on public.daily_school_briefs(workspace_id,coalesce(classroom_id,'00000000-0000-0000-0000-000000000000'::uuid),brief_date,report_type);
create index if not exists daily_brief_attachments_brief_idx on public.daily_brief_attachments(brief_id,created_at);

drop trigger if exists daily_school_briefs_touch_updated_at on public.daily_school_briefs;
create trigger daily_school_briefs_touch_updated_at before update on public.daily_school_briefs
for each row execute function public.touch_updated_at();

alter table public.daily_school_briefs enable row level security;
alter table public.daily_brief_logs enable row level security;
alter table public.daily_brief_revisions enable row level security;
alter table public.daily_brief_attachments enable row level security;

create policy daily_briefs_workspace_read on public.daily_school_briefs for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member','viewer']));
create policy daily_briefs_teacher_manage on public.daily_school_briefs for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']));
create policy daily_logs_workspace_read on public.daily_brief_logs for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member','viewer']));
create policy daily_logs_teacher_manage on public.daily_brief_logs for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']));
create policy daily_revisions_workspace_read on public.daily_brief_revisions for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member','viewer']));
create policy daily_revisions_teacher_create on public.daily_brief_revisions for insert to authenticated
with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']));
create policy daily_attachments_workspace_read on public.daily_brief_attachments for select to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member','viewer']));
create policy daily_attachments_teacher_manage on public.daily_brief_attachments for all to authenticated
using (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']))
with check (public.is_superadmin() or public.has_workspace_role(workspace_id,array['teacher_owner','teacher_member']));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('daily-briefs','daily-briefs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy daily_brief_files_read on storage.objects for select to authenticated using (
  bucket_id='daily-briefs' and (public.is_superadmin() or exists(select 1 from public.daily_brief_attachments a where a.storage_path=name and public.has_workspace_role(a.workspace_id,array['teacher_owner','teacher_member','viewer'])))
);
create policy daily_brief_files_insert on storage.objects for insert to authenticated with check (
  bucket_id='daily-briefs' and public.has_workspace_role(((storage.foldername(name))[1])::uuid,array['teacher_owner','teacher_member'])
);
create policy daily_brief_files_delete on storage.objects for delete to authenticated using (
  bucket_id='daily-briefs' and (public.is_superadmin() or public.has_workspace_role(((storage.foldername(name))[1])::uuid,array['teacher_owner','teacher_member']))
);

grant select,insert,update,delete on public.daily_school_briefs,public.daily_brief_logs to authenticated;
grant select,insert on public.daily_brief_revisions to authenticated;
grant select,insert,update,delete on public.daily_brief_attachments to authenticated;
