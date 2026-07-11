-- ClassCare 360 - Savings and Behavior foundation.
-- Adds classroom savings ledger and behavior record tables.

create table if not exists public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  status text not null default 'active'
    check (status in ('active', 'frozen', 'closed')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, student_id)
);

create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid references public.savings_accounts(id) on delete set null,
  student_id uuid not null references public.students(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('deposit', 'withdrawal', 'adjustment')),
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.behavior_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  tone text not null default 'positive'
    check (tone in ('positive', 'concern', 'support', 'discipline')),
  category text not null,
  description text not null,
  points integer not null default 0,
  follow_up_status text not null default 'none'
    check (follow_up_status in ('none', 'watch', 'contact_guardian', 'referred', 'resolved')),
  behavior_date date not null default current_date,
  recorded_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_accounts_workspace_student_idx
on public.savings_accounts (workspace_id, student_id);

create index if not exists savings_transactions_workspace_student_idx
on public.savings_transactions (workspace_id, student_id, transaction_date desc);

create index if not exists savings_transactions_workspace_created_idx
on public.savings_transactions (workspace_id, created_at desc);

create index if not exists behavior_records_workspace_student_idx
on public.behavior_records (workspace_id, student_id, behavior_date desc);

create index if not exists behavior_records_workspace_follow_up_idx
on public.behavior_records (workspace_id, follow_up_status, created_at desc);

drop trigger if exists savings_accounts_touch_updated_at on public.savings_accounts;
create trigger savings_accounts_touch_updated_at
before update on public.savings_accounts
for each row execute function public.touch_updated_at();

drop trigger if exists savings_transactions_touch_updated_at on public.savings_transactions;
create trigger savings_transactions_touch_updated_at
before update on public.savings_transactions
for each row execute function public.touch_updated_at();

drop trigger if exists behavior_records_touch_updated_at on public.behavior_records;
create trigger behavior_records_touch_updated_at
before update on public.behavior_records
for each row execute function public.touch_updated_at();

alter table public.savings_accounts enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.behavior_records enable row level security;

drop policy if exists "savings_accounts_select_teacher_or_superadmin" on public.savings_accounts;
create policy "savings_accounts_select_teacher_or_superadmin"
on public.savings_accounts
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "savings_accounts_upsert_teacher_or_superadmin" on public.savings_accounts;
create policy "savings_accounts_upsert_teacher_or_superadmin"
on public.savings_accounts
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

drop policy if exists "savings_transactions_select_teacher_or_superadmin" on public.savings_transactions;
create policy "savings_transactions_select_teacher_or_superadmin"
on public.savings_transactions
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "savings_transactions_insert_teacher_or_superadmin" on public.savings_transactions;
create policy "savings_transactions_insert_teacher_or_superadmin"
on public.savings_transactions
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "behavior_records_select_teacher_or_superadmin" on public.behavior_records;
create policy "behavior_records_select_teacher_or_superadmin"
on public.behavior_records
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "behavior_records_insert_teacher_or_superadmin" on public.behavior_records;
create policy "behavior_records_insert_teacher_or_superadmin"
on public.behavior_records
for insert
to authenticated
with check (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

drop policy if exists "behavior_records_update_teacher_or_superadmin" on public.behavior_records;
create policy "behavior_records_update_teacher_or_superadmin"
on public.behavior_records
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
