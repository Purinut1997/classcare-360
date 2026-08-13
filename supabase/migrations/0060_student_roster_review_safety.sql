-- Require an explicit roster review before permanent deletion from the UI.
-- Reviews remain auditable after the student row is deleted.

create table if not exists public.student_roster_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  student_snapshot jsonb not null default '{}'::jsonb,
  classification text not null default 'pending'
    check (classification in (
      'pending', 'belongs_here', 'duplicate', 'wrong_workspace',
      'transferred', 'graduated', 'inactive'
    )),
  note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_roster_reviews_live_student_idx
  on public.student_roster_reviews (workspace_id, student_id)
  where student_id is not null;

create index if not exists student_roster_reviews_queue_idx
  on public.student_roster_reviews (workspace_id, classification, updated_at desc);

alter table public.student_roster_reviews enable row level security;

drop trigger if exists student_roster_reviews_touch_updated_at on public.student_roster_reviews;
create trigger student_roster_reviews_touch_updated_at
before update on public.student_roster_reviews
for each row execute function public.touch_updated_at();

drop policy if exists "student_roster_reviews_select_owner_or_superadmin" on public.student_roster_reviews;
create policy "student_roster_reviews_select_owner_or_superadmin"
on public.student_roster_reviews for select to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

create or replace function public.set_student_roster_reviews(
  target_workspace_id uuid,
  target_student_ids uuid[],
  target_classification text,
  target_note text default null
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  expected_count integer;
  matched_count integer;
begin
  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not_allowed';
  end if;

  if target_classification not in (
    'pending', 'belongs_here', 'duplicate', 'wrong_workspace',
    'transferred', 'graduated', 'inactive'
  ) then
    raise exception 'invalid_classification';
  end if;

  select count(*) into expected_count
  from (select distinct unnest(coalesce(target_student_ids, '{}'::uuid[])) as id) requested;

  if expected_count = 0 then
    raise exception 'student_ids_required';
  end if;

  select count(*) into matched_count
  from public.students s
  where s.workspace_id = target_workspace_id
    and s.id = any(target_student_ids);

  if matched_count <> expected_count then
    raise exception 'student_outside_workspace_or_missing';
  end if;

  insert into public.student_roster_reviews (
    workspace_id, student_id, student_snapshot, classification,
    note, reviewed_by, reviewed_at
  )
  select
    s.workspace_id,
    s.id,
    jsonb_build_object(
      'id', s.id,
      'student_code', s.student_code,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'nickname', s.nickname,
      'classroom_id', s.classroom_id,
      'status', s.status
    ),
    target_classification,
    nullif(btrim(coalesce(target_note, '')), ''),
    auth.uid(),
    case when target_classification = 'pending' then null else now() end
  from public.students s
  where s.workspace_id = target_workspace_id
    and s.id = any(target_student_ids)
  on conflict (workspace_id, student_id) where student_id is not null
  do update set
    student_snapshot = excluded.student_snapshot,
    classification = excluded.classification,
    note = excluded.note,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = now();

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id,
    action, metadata, risk_level
  ) values (
    target_workspace_id, auth.uid(), 'student_roster_reviews', target_workspace_id,
    'student_roster.reviewed',
    jsonb_build_object(
      'classification', target_classification,
      'count', matched_count,
      'student_ids', target_student_ids,
      'has_note', nullif(btrim(coalesce(target_note, '')), '') is not null
    ),
    case when target_classification in ('duplicate', 'wrong_workspace') then 'high' else 'normal' end
  );

  return matched_count;
end;
$$;

create or replace function public.delete_reviewed_duplicate_students(
  target_workspace_id uuid,
  target_student_ids uuid[]
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  expected_count integer;
  eligible_count integer;
begin
  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner'])
  ) then
    raise exception 'not_allowed';
  end if;

  select count(*) into expected_count
  from (select distinct unnest(coalesce(target_student_ids, '{}'::uuid[])) as id) requested;

  if expected_count = 0 then
    raise exception 'student_ids_required';
  end if;

  select count(*) into eligible_count
  from public.students s
  join public.student_roster_reviews r
    on r.workspace_id = s.workspace_id and r.student_id = s.id
  where s.workspace_id = target_workspace_id
    and s.id = any(target_student_ids)
    and s.status = 'archived'
    and r.classification = 'duplicate'
    and r.reviewed_at is not null;

  if eligible_count <> expected_count then
    raise exception 'delete_requires_archived_reviewed_duplicates';
  end if;

  insert into public.trash_items (
    workspace_id, entity_type, entity_id, display_name, reason,
    payload, deleted_by, expires_at, metadata
  )
  select
    s.workspace_id,
    'student',
    s.id,
    concat_ws(' ', s.first_name, s.last_name),
    'reviewed_duplicate',
    to_jsonb(s),
    auth.uid(),
    now() + interval '90 days',
    jsonb_build_object(
      'review_id', r.id,
      'classification', r.classification,
      'review_note', r.note,
      'reviewed_by', r.reviewed_by,
      'reviewed_at', r.reviewed_at
    )
  from public.students s
  join public.student_roster_reviews r
    on r.workspace_id = s.workspace_id and r.student_id = s.id
  where s.workspace_id = target_workspace_id
    and s.id = any(target_student_ids);

  delete from public.students s
  where s.workspace_id = target_workspace_id
    and s.id = any(target_student_ids);

  insert into public.audit_logs (
    workspace_id, actor_profile_id, entity_table, entity_id,
    action, metadata, risk_level
  ) values (
    target_workspace_id, auth.uid(), 'students', target_workspace_id,
    'student_roster.reviewed_duplicates_deleted',
    jsonb_build_object('count', expected_count, 'student_ids', target_student_ids),
    'critical'
  );

  return expected_count;
end;
$$;

revoke all on function public.set_student_roster_reviews(uuid, uuid[], text, text) from public;
revoke all on function public.delete_reviewed_duplicate_students(uuid, uuid[]) from public;
grant execute on function public.set_student_roster_reviews(uuid, uuid[], text, text) to authenticated;
grant execute on function public.delete_reviewed_duplicate_students(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
