-- 0100_deep_defense_ai_vault_and_public_rate_limits.sql
-- Phase 5 Deep Defense Lockdown (Zero-Downtime / Expand-and-Contract compliant):
-- 1. Move workspace Gemini API keys out of client-readable public.workspaces into server-only public.workspace_ai_secrets
--    with a transparent BEFORE INSERT OR UPDATE interceptor trigger on public.workspaces for backward compatibility.
-- 2. Add brute-force lockout (5 failed attempts / 15 min) & strip unrendered raw notes/items in lookup_public_student_report.
-- 3. Tighten storage.objects SELECT RLS on student-avatars and evidence-files so parent/student roles can only access their own linked student's files.

-- =====================================================================
-- 1. Server-Only Workspace AI Secrets Vault + Backward-Compatible Trigger
-- =====================================================================
create table if not exists public.workspace_ai_secrets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  gemini_api_key text,
  ai_model text not null default 'gemini-2.5-flash',
  is_ai_enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.workspace_ai_secrets enable row level security;
-- Intentionally zero client RLS policies: only service_role and SECURITY DEFINER RPCs may access public.workspace_ai_secrets.

-- Backfill existing keys from public.workspaces into public.workspace_ai_secrets
insert into public.workspace_ai_secrets (workspace_id, gemini_api_key, ai_model, is_ai_enabled, updated_at)
select
  w.id,
  coalesce(
    nullif(trim(w.gemini_api_key), ''),
    nullif(trim(w.settings ->> 'gemini_api_key'), '')
  ) as gemini_api_key,
  coalesce(
    nullif(trim(w.ai_model), ''),
    nullif(trim(w.settings ->> 'ai_model'), ''),
    'gemini-2.5-flash'
  ) as ai_model,
  coalesce(
    w.is_ai_enabled,
    case
      when jsonb_typeof(w.settings -> 'is_ai_enabled') = 'boolean'
        then (w.settings ->> 'is_ai_enabled')::boolean
      else true
    end,
    true
  ) as is_ai_enabled,
  now()
from public.workspaces w
where coalesce(
  nullif(trim(w.gemini_api_key), ''),
  nullif(trim(w.settings ->> 'gemini_api_key'), '')
) is not null
on conflict (workspace_id) do update
set
  gemini_api_key = coalesce(excluded.gemini_api_key, public.workspace_ai_secrets.gemini_api_key),
  ai_model = excluded.ai_model,
  is_ai_enabled = excluded.is_ai_enabled,
  updated_at = now();

-- Scrub plaintext gemini_api_key from public.workspaces while leaving non-secret has_workspace_ai_key indicator
update public.workspaces w
set
  gemini_api_key = null,
  settings = (coalesce(w.settings, '{}'::jsonb) - 'gemini_api_key')
    || jsonb_build_object(
      'has_workspace_ai_key',
      exists (
        select 1
        from public.workspace_ai_secrets s
        where s.workspace_id = w.id
          and length(trim(coalesce(s.gemini_api_key, ''))) > 5
      )
    )
where w.gemini_api_key is not null
   or (w.settings is not null and w.settings ? 'gemini_api_key');

-- Transparent interceptor trigger: if any legacy client writes gemini_api_key to public.workspaces,
-- move it into public.workspace_ai_secrets and scrub it from the client-readable row automatically.
create or replace function public.enforce_workspace_ai_key_vault()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incoming_col_key text := nullif(trim(coalesce(new.gemini_api_key, '')), '');
  v_incoming_json_key text := null;
  v_effective_key text := null;
  v_has_json_key_prop boolean := false;
  v_model text;
  v_enabled boolean;
begin
  if new.settings is not null and jsonb_typeof(new.settings) = 'object' and (new.settings ? 'gemini_api_key') then
    v_has_json_key_prop := true;
    v_incoming_json_key := nullif(trim(coalesce(new.settings ->> 'gemini_api_key', '')), '');
  end if;

  v_effective_key := coalesce(v_incoming_col_key, v_incoming_json_key);
  v_model := coalesce(
    nullif(trim(coalesce(new.ai_model, '')), ''),
    nullif(trim(coalesce(new.settings ->> 'ai_model', '')), ''),
    'gemini-2.5-flash'
  );
  v_enabled := coalesce(
    new.is_ai_enabled,
    case
      when new.settings is not null and jsonb_typeof(new.settings -> 'is_ai_enabled') = 'boolean'
        then (new.settings ->> 'is_ai_enabled')::boolean
      else true
    end,
    true
  );

  if v_effective_key is not null and v_effective_key <> 'SERVER_MANAGED_WORKSPACE_KEY' and v_effective_key not like '••••%' then
    if auth.uid() is null or public.is_superadmin() or public.has_workspace_role(new.id, array['teacher_owner']) then
      insert into public.workspace_ai_secrets (workspace_id, gemini_api_key, ai_model, is_ai_enabled, updated_by, updated_at)
      values (new.id, v_effective_key, v_model, v_enabled, auth.uid(), now())
      on conflict (workspace_id) do update
      set gemini_api_key = excluded.gemini_api_key,
          ai_model = excluded.ai_model,
          is_ai_enabled = excluded.is_ai_enabled,
          updated_by = coalesce(auth.uid(), public.workspace_ai_secrets.updated_by),
          updated_at = now();
    end if;
  elsif v_has_json_key_prop and v_incoming_json_key is null then
    -- Explicit key deletion via settings.gemini_api_key = null / ''
    if auth.uid() is null or public.is_superadmin() or public.has_workspace_role(new.id, array['teacher_owner']) then
      update public.workspace_ai_secrets
      set gemini_api_key = null,
          ai_model = v_model,
          is_ai_enabled = false,
          updated_by = auth.uid(),
          updated_at = now()
      where workspace_id = new.id;
    end if;
  end if;

  -- Always keep public.workspaces free of plaintext gemini_api_key
  new.gemini_api_key := null;
  if new.settings is not null and jsonb_typeof(new.settings) = 'object' then
    new.settings := (new.settings - 'gemini_api_key')
      || jsonb_build_object(
        'has_workspace_ai_key',
        exists (
          select 1
          from public.workspace_ai_secrets s
          where s.workspace_id = new.id
            and length(trim(coalesce(s.gemini_api_key, ''))) > 5
        )
      );
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_workspace_ai_key_vault() from public, anon;

drop trigger if exists trg_enforce_workspace_ai_key_vault on public.workspaces;
create trigger trg_enforce_workspace_ai_key_vault
before insert or update on public.workspaces
for each row
execute function public.enforce_workspace_ai_key_vault();

-- Update set_workspace_ai_key RPC to store directly in workspace_ai_secrets
create or replace function public.set_workspace_ai_key(
  target_workspace_id uuid,
  new_api_key text,
  new_model text default 'gemini-2.5-flash'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_key text := nullif(trim(coalesce(new_api_key, '')), '');
  v_model text := coalesce(nullif(trim(coalesce(new_model, '')), ''), 'gemini-2.5-flash');
  v_has_key boolean := (v_clean_key is not null and length(v_clean_key) > 5);
begin
  if not (public.is_superadmin() or public.has_workspace_role(target_workspace_id, array['teacher_owner'])) then
    raise exception 'Permission denied: only superadmin or workspace owner can configure AI settings';
  end if;

  insert into public.workspace_ai_secrets (
    workspace_id,
    gemini_api_key,
    ai_model,
    is_ai_enabled,
    updated_by,
    updated_at
  )
  values (
    target_workspace_id,
    case when v_has_key then v_clean_key else null end,
    v_model,
    v_has_key,
    auth.uid(),
    now()
  )
  on conflict (workspace_id) do update
  set gemini_api_key = excluded.gemini_api_key,
      ai_model = excluded.ai_model,
      is_ai_enabled = excluded.is_ai_enabled,
      updated_by = auth.uid(),
      updated_at = now();

  update public.workspaces
  set gemini_api_key = null,
      ai_model = v_model,
      is_ai_enabled = v_has_key,
      settings = (coalesce(settings, '{}'::jsonb) - 'gemini_api_key')
        || jsonb_build_object(
          'has_workspace_ai_key', v_has_key,
          'ai_model', v_model,
          'is_ai_enabled', v_has_key
        ),
      updated_at = now()
  where id = target_workspace_id;
end;
$$;

revoke all on function public.set_workspace_ai_key(uuid, text, text) from public, anon;
grant execute on function public.set_workspace_ai_key(uuid, text, text) to authenticated;

-- Safe RPC for teachers to resolve workspace AI status without exposing raw key to non-owners
create or replace function public.get_workspace_ai_config_status(target_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_secret public.workspace_ai_secrets%rowtype;
  v_ws public.workspaces%rowtype;
  v_is_owner boolean := false;
  v_has_key boolean := false;
  v_model text := 'gemini-2.5-flash';
  v_enabled boolean := true;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner', 'teacher_member'])
  ) then
    return jsonb_build_object(
      'has_key', false,
      'is_ai_enabled', false,
      'ai_model', 'gemini-2.5-flash',
      'api_key', null
    );
  end if;

  v_is_owner := public.is_superadmin() or public.has_workspace_role(target_workspace_id, array['teacher_owner']);

  select * into v_secret from public.workspace_ai_secrets where workspace_id = target_workspace_id;
  select * into v_ws from public.workspaces where id = target_workspace_id;

  v_has_key := length(trim(coalesce(v_secret.gemini_api_key, ''))) > 5;
  v_model := coalesce(
    nullif(trim(coalesce(v_secret.ai_model, '')), ''),
    nullif(trim(coalesce(v_ws.ai_model, '')), ''),
    nullif(trim(coalesce(v_ws.settings ->> 'ai_model', '')), ''),
    'gemini-2.5-flash'
  );
  v_enabled := coalesce(v_secret.is_ai_enabled, v_ws.is_ai_enabled, true);

  return jsonb_build_object(
    'has_key', v_has_key,
    'is_ai_enabled', v_enabled,
    'ai_model', v_model,
    'api_key', case when v_is_owner and v_has_key then v_secret.gemini_api_key else null end
  );
end;
$$;

revoke all on function public.get_workspace_ai_config_status(uuid) from public, anon;
grant execute on function public.get_workspace_ai_config_status(uuid) to authenticated;

-- =====================================================================
-- 2. Public Student Report Brute-Force Lockout & Minimal Payload
-- =====================================================================
create table if not exists public.public_report_lookup_attempts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  citizen_id_hash text not null,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, citizen_id_hash)
);

alter table public.public_report_lookup_attempts enable row level security;
-- Zero client RLS policies: accessed strictly inside lookup_public_student_report SECURITY DEFINER RPC.

create or replace function public.lookup_public_student_report(
  target_workspace_id uuid,
  citizen_id text,
  target_birth_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_record record;
  student_record record;
  attempt_record public.public_report_lookup_attempts%rowtype;
  policy jsonb;
  normalized_id text := public.normalize_thai_citizen_id(citizen_id);
  cid_attempt_hash text;
  lookup_hash text;
  next_failed_count integer;
  attendance_payload jsonb := 'null'::jsonb;
  scores_payload jsonb := 'null'::jsonb;
  savings_payload jsonb := 'null'::jsonb;
  behavior_payload jsonb := 'null'::jsonb;
  home_visit_payload jsonb := 'null'::jsonb;
  guardians_payload jsonb := 'null'::jsonb;
begin
  if length(normalized_id) <> 13 or target_birth_date is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_identity');
  end if;

  select id, name, school_name, academic_year, settings
    into workspace_record
  from public.workspaces
  where id = target_workspace_id
    and archived_at is null;

  if workspace_record.id is null then
    return jsonb_build_object('ok', false, 'reason', 'workspace_not_found');
  end if;

  policy := coalesce(workspace_record.settings->'public_report', '{}'::jsonb);

  if not coalesce((policy->>'enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'public_report_disabled');
  end if;

  cid_attempt_hash := encode(
    extensions.digest(target_workspace_id::text || ':public_report_cid:' || normalized_id, 'sha256'),
    'hex'
  );

  select *
    into attempt_record
  from public.public_report_lookup_attempts
  where workspace_id = target_workspace_id
    and citizen_id_hash = cid_attempt_hash;

  if attempt_record.locked_until is not null and attempt_record.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  lookup_hash := public.public_lookup_hash(target_workspace_id, target_birth_date, normalized_id);

  select s.id,
         s.student_code,
         s.first_name,
         s.last_name,
         s.nickname,
         s.status,
         s.birth_date,
         c.name as classroom_name
    into student_record
  from public.students s
  left join public.classrooms c on c.id = s.classroom_id
  where s.workspace_id = target_workspace_id
    and s.birth_date = target_birth_date
    and s.status in ('active', 'transferred', 'graduated')
    and s.metadata->>'public_lookup_id_hash' = lookup_hash
  limit 1;

  if student_record.id is null then
    next_failed_count := case
      when attempt_record.citizen_id_hash is null or attempt_record.window_started_at < (now() - interval '15 minutes')
        then 1
      else attempt_record.failed_count + 1
    end;

    insert into public.public_report_lookup_attempts (
      workspace_id,
      citizen_id_hash,
      failed_count,
      window_started_at,
      locked_until,
      updated_at
    )
    values (
      target_workspace_id,
      cid_attempt_hash,
      next_failed_count,
      case
        when attempt_record.citizen_id_hash is null or attempt_record.window_started_at < (now() - interval '15 minutes')
          then now()
        else attempt_record.window_started_at
      end,
      case when next_failed_count >= 5 then now() + interval '15 minutes' else null end,
      now()
    )
    on conflict (workspace_id, citizen_id_hash) do update
    set failed_count = excluded.failed_count,
        window_started_at = excluded.window_started_at,
        locked_until = excluded.locked_until,
        updated_at = now();

    if next_failed_count >= 5 then
      return jsonb_build_object('ok', false, 'reason', 'rate_limited');
    end if;

    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  -- Reset failed attempt counter on valid lookup
  if attempt_record.citizen_id_hash is not null then
    delete from public.public_report_lookup_attempts
    where workspace_id = target_workspace_id
      and citizen_id_hash = cid_attempt_hash;
  end if;

  if coalesce((policy->>'attendance')::boolean, false) then
    select jsonb_build_object(
      'total', count(*),
      'present', count(*) filter (where ar.status = 'present'),
      'absent', count(*) filter (where ar.status = 'absent'),
      'late', count(*) filter (where ar.status = 'late'),
      'leave', count(*) filter (where ar.status = 'leave'),
      'latest', '[]'::jsonb
    )
      into attendance_payload
    from public.attendance_records ar
    join public.attendance_sessions ats on ats.id = ar.session_id
    where ar.workspace_id = target_workspace_id
      and ar.student_id = student_record.id;
  end if;

  if coalesce((policy->>'scores')::boolean, false) then
    select jsonb_build_object(
      'entries', count(se.*),
      'average_percent', round(avg((se.score / nullif(sa.max_score, 0)) * 100), 2),
      'latest', '[]'::jsonb
    )
      into scores_payload
    from public.score_entries se
    join public.score_assessments sa on sa.id = se.assessment_id
    where se.workspace_id = target_workspace_id
      and se.student_id = student_record.id;
  end if;

  if coalesce((policy->>'savings')::boolean, false) then
    select jsonb_build_object(
      'balance', coalesce(sa.balance, 0),
      'status', sa.status
    )
      into savings_payload
    from public.savings_accounts sa
    where sa.workspace_id = target_workspace_id
      and sa.student_id = student_record.id;
  end if;

  if coalesce((policy->>'behavior')::boolean, false) then
    select jsonb_build_object(
      'records', count(*),
      'positive', count(*) filter (where tone = 'positive'),
      'concern', count(*) filter (where tone = 'concern'),
      'follow_up', count(*) filter (where follow_up_status <> 'none')
    )
      into behavior_payload
    from public.behavior_records
    where workspace_id = target_workspace_id
      and student_id = student_record.id;
  end if;

  if coalesce((policy->>'home_visit')::boolean, false) then
    select jsonb_build_object(
      'status', status,
      'completion_percent', completion_percent,
      'updated_at', updated_at
    )
      into home_visit_payload
    from public.student_home_visits
    where workspace_id = target_workspace_id
      and student_id = student_record.id
    order by updated_at desc
    limit 1;
  end if;

  if coalesce((policy->>'guardians')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'relation', relation,
      'display_name', display_name,
      'is_primary', is_primary
    ) order by is_primary desc, created_at asc), '[]'::jsonb)
      into guardians_payload
    from public.student_guardians
    where workspace_id = target_workspace_id
      and student_id = student_record.id
      and consent_status = 'granted';
  end if;

  return jsonb_build_object(
    'ok', true,
    'workspace', jsonb_build_object(
      'id', workspace_record.id,
      'name', workspace_record.name,
      'school_name', workspace_record.school_name,
      'academic_year', workspace_record.academic_year
    ),
    'student', jsonb_build_object(
      'student_code', student_record.student_code,
      'first_name', student_record.first_name,
      'last_name', student_record.last_name,
      'nickname', student_record.nickname,
      'classroom_name', student_record.classroom_name,
      'status', student_record.status
    ),
    'policy', policy,
    'attendance', attendance_payload,
    'scores', scores_payload,
    'savings', savings_payload,
    'behavior', behavior_payload,
    'home_visit', home_visit_payload,
    'guardians', guardians_payload
  );
end;
$$;

revoke all on function public.lookup_public_student_report(uuid, text, date) from public;
grant execute on function public.lookup_public_student_report(uuid, text, date) to authenticated, anon;

-- =====================================================================
-- 3. Align storage.objects SELECT RLS on student-avatars & evidence-files
-- =====================================================================
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
      then (
        public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member', 'viewer'])
        or exists (
          select 1
          from public.app_files af
          join public.students s on s.workspace_id = af.workspace_id and s.avatar_file_id = af.id
          where af.bucket = 'student-avatars'
            and af.storage_path = storage.objects.name
            and af.deleted_at is null
            and public.is_linked_portal_student(s.workspace_id, s.id)
        )
      )
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
      then (
        public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member', 'viewer'])
        or exists (
          select 1
          from public.app_files af
          join public.student_evidence_files ef on ef.workspace_id = af.workspace_id and ef.file_id = af.id
          where af.bucket = 'evidence-files'
            and af.storage_path = storage.objects.name
            and af.deleted_at is null
            and ef.student_id is not null
            and public.is_linked_portal_student(ef.workspace_id, ef.student_id)
        )
      )
      else false
    end
  )
);

notify pgrst, 'reload schema';
