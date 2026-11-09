-- Idempotency and delivery history for per-teacher automatic Telegram reports.
-- The service role is the only reader/writer; teachers cannot inspect other delivery metadata.
create table if not exists public.teacher_notification_delivery_log (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null,
  delivery_key text not null,
  delivery_kind text not null,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed', 'skipped')),
  error_message text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (workspace_id, profile_id, delivery_key),
  constraint teacher_notification_delivery_membership_fk
    foreign key (workspace_id, profile_id)
    references public.workspace_memberships (workspace_id, profile_id)
    on delete cascade
);

create index if not exists teacher_notification_delivery_recent_idx
  on public.teacher_notification_delivery_log (workspace_id, profile_id, created_at desc);

alter table public.teacher_notification_delivery_log enable row level security;
revoke all on public.teacher_notification_delivery_log from anon, authenticated;
grant all on public.teacher_notification_delivery_log to service_role;

comment on table public.teacher_notification_delivery_log is
  'Idempotency and delivery status for private per-teacher Telegram summaries.';

notify pgrst, 'reload schema';
