-- Phase 3: Full Parent/Student Portal RLS (Scores, Savings, Behavior, Desirable Traits)
-- plus Online Student Leave Requests with composite multi-tenant foreign keys.
-- Strictly additive & backward-compatible (Safe System Updates / Zero Downtime).

-- 1. Helper: check whether the authenticated portal user is actively linked to (workspace_id, student_id)
create or replace function public.is_linked_portal_student(target_workspace_id uuid, target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_guardians sg
    where sg.workspace_id = target_workspace_id
      and sg.student_id = target_student_id
      and sg.profile_id = auth.uid()
      and sg.consent_status = 'granted'
  )
  or exists (
    select 1
    from public.student_profile_links spl
    where spl.workspace_id = target_workspace_id
      and spl.student_id = target_student_id
      and spl.profile_id = auth.uid()
      and spl.status = 'active'
  );
$$;

revoke all on function public.is_linked_portal_student(uuid, uuid) from public;
grant execute on function public.is_linked_portal_student(uuid, uuid) to authenticated;

-- 2. Additive SELECT policies for linked parents and students (staff policies untouched)

-- 2a. score_assessments (read published assessments in rooms where the caller has a linked student)
drop policy if exists "score_assessments_select_linked_portal" on public.score_assessments;
create policy "score_assessments_select_linked_portal"
on public.score_assessments
for select
to authenticated
using (
  status <> 'archived'
  and exists (
    select 1
    from public.students st
    where st.workspace_id = score_assessments.workspace_id
      and st.classroom_id = score_assessments.classroom_id
      and public.is_linked_portal_student(st.workspace_id, st.id)
  )
);

-- 2b. score_entries
drop policy if exists "score_entries_select_linked_portal" on public.score_entries;
create policy "score_entries_select_linked_portal"
on public.score_entries
for select
to authenticated
using (public.is_linked_portal_student(workspace_id, student_id));

-- 2c. savings_accounts
drop policy if exists "savings_accounts_select_linked_portal" on public.savings_accounts;
create policy "savings_accounts_select_linked_portal"
on public.savings_accounts
for select
to authenticated
using (public.is_linked_portal_student(workspace_id, student_id));

-- 2d. savings_transactions
drop policy if exists "savings_transactions_select_linked_portal" on public.savings_transactions;
create policy "savings_transactions_select_linked_portal"
on public.savings_transactions
for select
to authenticated
using (public.is_linked_portal_student(workspace_id, student_id));

-- 2e. behavior_records
drop policy if exists "behavior_records_select_linked_portal" on public.behavior_records;
create policy "behavior_records_select_linked_portal"
on public.behavior_records
for select
to authenticated
using (public.is_linked_portal_student(workspace_id, student_id));

-- 2f. student_desirable_records
drop policy if exists "student_desirable_records_select_linked_portal" on public.student_desirable_records;
create policy "student_desirable_records_select_linked_portal"
on public.student_desirable_records
for select
to authenticated
using (public.is_linked_portal_student(workspace_id, student_id));

-- 3. Online Student Leave Requests (Guardian submits -> Teacher approves in Attendance)
create table if not exists public.student_leave_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid not null,
  classroom_id uuid not null,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null default 'sick' check (leave_type in ('sick', 'personal', 'other')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_leave_requests_dates_check check (end_date >= start_date),
  constraint student_leave_requests_student_workspace_fkey
    foreign key (student_id, workspace_id)
    references public.students (id, workspace_id)
    on delete cascade,
  constraint student_leave_requests_classroom_workspace_fkey
    foreign key (classroom_id, workspace_id)
    references public.classrooms (id, workspace_id)
    on delete cascade
);

create index if not exists student_leave_requests_room_dates_idx
  on public.student_leave_requests (workspace_id, classroom_id, start_date, end_date);

create index if not exists student_leave_requests_student_recent_idx
  on public.student_leave_requests (workspace_id, student_id, created_at desc);

drop trigger if exists student_leave_requests_touch_updated_at on public.student_leave_requests;
create trigger student_leave_requests_touch_updated_at
before update on public.student_leave_requests
for each row execute function public.touch_updated_at();

alter table public.student_leave_requests enable row level security;

drop policy if exists "student_leave_requests_select_scoped_or_portal" on public.student_leave_requests;
create policy "student_leave_requests_select_scoped_or_portal"
on public.student_leave_requests
for select
to authenticated
using (
  public.can_access_student(workspace_id, student_id)
  or public.is_linked_portal_student(workspace_id, student_id)
);

drop policy if exists "student_leave_requests_insert_guardian" on public.student_leave_requests;
create policy "student_leave_requests_insert_guardian"
on public.student_leave_requests
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.student_guardians sg
    where sg.workspace_id = student_leave_requests.workspace_id
      and sg.student_id = student_leave_requests.student_id
      and sg.profile_id = auth.uid()
      and sg.consent_status = 'granted'
  )
);

drop policy if exists "student_leave_requests_update_teacher_or_guardian" on public.student_leave_requests;
create policy "student_leave_requests_update_teacher_or_guardian"
on public.student_leave_requests
for update
to authenticated
using (
  (
    public.has_workspace_capability(workspace_id, 'attendance.write')
    and public.can_access_student(workspace_id, student_id)
  )
  or (
    submitted_by = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.student_guardians sg
      where sg.workspace_id = student_leave_requests.workspace_id
        and sg.student_id = student_leave_requests.student_id
        and sg.profile_id = auth.uid()
        and sg.consent_status = 'granted'
    )
  )
)
with check (
  (
    public.has_workspace_capability(workspace_id, 'attendance.write')
    and public.can_access_student(workspace_id, student_id)
  )
  or (
    submitted_by = auth.uid()
    and status = 'cancelled'
  )
);

notify pgrst, 'reload schema';
