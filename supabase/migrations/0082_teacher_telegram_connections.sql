-- Per-teacher Telegram bot credentials. Secrets are encrypted by an Edge Function
-- and this table is intentionally inaccessible to browser roles.
create table if not exists public.teacher_telegram_connections (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null,
  encrypted_bot_token text,
  encrypted_chat_id text,
  bot_username text,
  status text not null default 'disconnected'
    check (status in ('pending', 'connected', 'disconnected')),
  verification_code_hash text,
  verification_expires_at timestamptz,
  start_nonce_hash text,
  encrypted_start_nonce text,
  verification_attempts integer not null default 0 check (verification_attempts between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, profile_id),
  constraint teacher_telegram_connections_membership_fk
    foreign key (workspace_id, profile_id)
    references public.workspace_memberships (workspace_id, profile_id)
    on delete cascade
);

create index if not exists teacher_telegram_connections_profile_idx
  on public.teacher_telegram_connections (profile_id, workspace_id);

alter table public.teacher_telegram_connections enable row level security;
revoke all on public.teacher_telegram_connections from anon, authenticated;
grant all on public.teacher_telegram_connections to service_role;

comment on table public.teacher_telegram_connections is
  'Encrypted, profile-scoped Telegram credentials. Access only through authenticated Edge Functions.';
