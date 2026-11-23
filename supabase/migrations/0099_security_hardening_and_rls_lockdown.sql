-- 0099_security_hardening_and_rls_lockdown.sql
-- Phase 1 Security Hardening (Zero-Downtime / Expand-and-Contract compliant):
-- 1. Lock public.profiles.email & account_status against self-spoofing / self-unsuspension
-- 2. Bind portal & teacher invitation acceptance + admin grants to verified auth.users.email
-- 3. Prevent cross-tenant storage_path injection on public.app_files & tighten parent/student file RLS
-- 4. Lock finalized online exam submissions against overwrite & bound live_points to server-verified score
-- 5. Enforce search_path = public & revoke anon/public execute on SECURITY DEFINER functions

-- =====================================================================
-- 1. Verified Auth Email Helper & Profile Security Invariants Trigger
-- =====================================================================
create or replace function public.current_authenticated_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(u.email))
  from auth.users u
  where u.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_authenticated_email() from public, anon;
grant execute on function public.current_authenticated_email() to authenticated;

-- Sync any drifted profile emails back to verified auth.users.email
update public.profiles p
set email = u.email,
    updated_at = now()
from auth.users u
where p.id = u.id
  and u.email is not null
  and lower(trim(coalesce(p.email, ''))) <> lower(trim(u.email));

create or replace function public.enforce_profile_security_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified_email text;
begin
  -- Service-role / background jobs (auth.uid() is null) or active superadmins may perform administrative updates
  if auth.uid() is not null and not public.is_superadmin() then
    select u.email
    into v_verified_email
    from auth.users u
    where u.id = new.id
    limit 1;

    if tg_op = 'INSERT' then
      if v_verified_email is not null then
        new.email := v_verified_email;
      end if;
      new.account_status := 'active';
    elsif tg_op = 'UPDATE' then
      new.email := coalesce(v_verified_email, old.email);
      new.account_status := old.account_status;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_profile_security_invariants() from public, anon;

drop trigger if exists trg_enforce_profile_security_invariants on public.profiles;
create trigger trg_enforce_profile_security_invariants
before insert or update on public.profiles
for each row
execute function public.enforce_profile_security_invariants();

-- =====================================================================
-- 2. Invitation & Admin Grant Policies Bound to Verified Auth Email
-- =====================================================================
drop policy if exists "portal_invitations_select_teacher_invitee_or_superadmin" on public.portal_invitations;
create policy "portal_invitations_select_teacher_invitee_or_superadmin"
on public.portal_invitations
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
  or accepted_by = auth.uid()
  or lower(trim(invite_email)) = public.current_authenticated_email()
);

drop policy if exists "workspace_teacher_invitations_select_owner_invitee" on public.workspace_teacher_invitations;
create policy "workspace_teacher_invitations_select_owner_invitee"
on public.workspace_teacher_invitations
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
  or lower(trim(invite_email)) = public.current_authenticated_email()
);

create or replace function public.list_my_workspace_teacher_invitations()
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  school_name text,
  role text,
  assigned_classroom_ids uuid[],
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.workspace_id, w.name, coalesce(w.school_name, w.name), i.role,
    i.assigned_classroom_ids, i.expires_at, i.created_at
  from public.workspace_teacher_invitations i
  join public.workspaces w on w.id = i.workspace_id and w.archived_at is null
  where lower(trim(i.invite_email)) = public.current_authenticated_email()
    and i.status = 'invited'
    and i.expires_at > now()
  order by i.created_at desc;
$$;

revoke all on function public.list_my_workspace_teacher_invitations() from public, anon;
grant execute on function public.list_my_workspace_teacher_invitations() to authenticated;

create or replace function public.accept_workspace_teacher_invitation(target_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_teacher_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  current_email := public.current_authenticated_email();
  if current_email is null or current_email = '' then
    raise exception 'verified_email_required';
  end if;

  select * into invitation from public.workspace_teacher_invitations where id = target_invitation_id for update;

  if invitation.id is null then raise exception 'invitation_not_found'; end if;
  if invitation.status <> 'invited' then raise exception 'invitation_not_pending'; end if;
  if invitation.expires_at <= now() then
    update public.workspace_teacher_invitations set status = 'expired', updated_at = now() where id = invitation.id;
    raise exception 'invitation_expired';
  end if;
  if lower(trim(invitation.invite_email)) <> current_email then raise exception 'invitation_email_mismatch'; end if;

  if exists (
    select 1 from unnest(invitation.assigned_classroom_ids) assigned_id
    left join public.classrooms c on c.id = assigned_id and c.workspace_id = invitation.workspace_id and c.status = 'active'
    where c.id is null
  ) then raise exception 'invitation_classroom_invalid'; end if;

  insert into public.workspace_memberships (
    workspace_id, profile_id, role, status, permissions, invited_by, joined_at
  ) values (
    invitation.workspace_id, auth.uid(), invitation.role, 'active', invitation.permission_overrides,
    invitation.invited_by, now()
  ) on conflict (workspace_id, profile_id) do update
  set role = case when public.workspace_memberships.role = 'teacher_owner' then 'teacher_owner' else excluded.role end,
      status = 'active', permissions = excluded.permissions, invited_by = excluded.invited_by,
      joined_at = coalesce(public.workspace_memberships.joined_at, now()), updated_at = now();

  delete from public.workspace_member_classrooms
  where workspace_id = invitation.workspace_id and profile_id = auth.uid();
  insert into public.workspace_member_classrooms (workspace_id, profile_id, classroom_id, created_by)
  select invitation.workspace_id, auth.uid(), classroom_id, invitation.invited_by
  from unnest(invitation.assigned_classroom_ids) classroom_id;

  update public.workspace_teacher_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now()
  where id = invitation.id;

  insert into public.audit_logs (workspace_id, actor_profile_id, actor_role, action, entity_table, entity_id, risk_level, metadata)
  values (
    invitation.workspace_id, auth.uid(), invitation.role, 'workspace_teacher_invitation.accepted',
    'workspace_teacher_invitations', invitation.id, 'normal',
    jsonb_build_object('subscription_inherited', true, 'classroom_ids', invitation.assigned_classroom_ids)
  );

  return jsonb_build_object(
    'accepted', true, 'workspace_id', invitation.workspace_id,
    'role', invitation.role, 'subscription_inherited', true
  );
end;
$$;

revoke all on function public.accept_workspace_teacher_invitation(uuid) from public, anon;
grant execute on function public.accept_workspace_teacher_invitation(uuid) to authenticated;

create or replace function public.grant_admin_access_by_email(
  target_email text,
  target_level text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(target_email));
  target_profile public.profiles%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  if target_level not in ('admin', 'superadmin') then
    raise exception 'invalid_admin_level';
  end if;

  select p.*
  into target_profile
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(trim(u.email)) = normalized_email
  limit 1;

  if target_profile.id is null then
    return jsonb_build_object('granted', false, 'reason', 'profile_not_found');
  end if;

  insert into public.superadmin_profiles (
    profile_id,
    level,
    is_active,
    created_by
  )
  values (
    target_profile.id,
    target_level,
    true,
    auth.uid()
  )
  on conflict (profile_id) do update
  set level = excluded.level,
      is_active = true;

  insert into public.audit_logs (
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    metadata
  )
  values (
    auth.uid(),
    'superadmin_profiles',
    target_profile.id,
    'admin_access_granted',
    jsonb_build_object(
      'email', normalized_email,
      'level', target_level,
      'lifetime_vip', true
    )
  );

  return jsonb_build_object(
    'granted', true,
    'profile_id', target_profile.id,
    'email', normalized_email,
    'display_name', coalesce(target_profile.display_name, normalized_email),
    'level', target_level
  );
end;
$$;

revoke all on function public.grant_admin_access_by_email(text, text) from public, anon;
grant execute on function public.grant_admin_access_by_email(text, text) to authenticated;

-- =====================================================================
-- 3. app_files & student_evidence_files Multi-Tenant Path & Role Lockdown
-- =====================================================================
create or replace function public.enforce_app_files_security_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if position('..' in coalesce(new.storage_path, '')) > 0 then
    raise exception 'invalid_storage_path';
  end if;

  -- Enforce strict invariants for non-service-role client requests
  if auth.uid() is not null and not public.is_superadmin() then
    if new.workspace_id is not null and coalesce(new.storage_provider, 'supabase') = 'supabase' then
      if coalesce(new.storage_path, '') not like (new.workspace_id::text || '/%') then
        raise exception 'storage_path_workspace_mismatch';
      end if;
    end if;

    if tg_op = 'UPDATE' then
      if old.workspace_id is distinct from new.workspace_id
         or old.bucket is distinct from new.bucket
         or old.storage_path is distinct from new.storage_path
         or old.storage_provider is distinct from new.storage_provider
         or old.external_file_id is distinct from new.external_file_id then
        raise exception 'immutable_file_storage_pointer';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_app_files_security_invariants() from public, anon;

drop trigger if exists trg_enforce_app_files_security_invariants on public.app_files;
create trigger trg_enforce_app_files_security_invariants
before insert or update on public.app_files
for each row
execute function public.enforce_app_files_security_invariants();

drop policy if exists "student_evidence_files_select_member" on public.student_evidence_files;
create policy "student_evidence_files_select_member"
on public.student_evidence_files
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
  or (
    student_id is not null
    and public.is_linked_portal_student(workspace_id, student_id)
  )
);

drop policy if exists "app_files_select_workspace_owner_or_superadmin" on public.app_files;
create policy "app_files_select_workspace_owner_or_superadmin"
on public.app_files
for select
to authenticated
using (
  public.is_superadmin()
  or owner_profile_id = auth.uid()
  or (
    workspace_id is not null
    and (
      case
        when coalesce(folder_category, '') = 'workspace_backup'
          then public.has_workspace_role(workspace_id, array['teacher_owner'])
        else (
          public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
          or exists (
            select 1
            from public.students s
            where s.workspace_id = app_files.workspace_id
              and s.avatar_file_id = app_files.id
              and public.is_linked_portal_student(s.workspace_id, s.id)
          )
          or exists (
            select 1
            from public.student_evidence_files ef
            where ef.workspace_id = app_files.workspace_id
              and ef.file_id = app_files.id
              and ef.student_id is not null
              and public.is_linked_portal_student(ef.workspace_id, ef.student_id)
          )
        )
      end
    )
  )
);

-- =====================================================================
-- 4. Online Exam Submission Finalization Lock & Server-Bounded Live Points
-- =====================================================================
create or replace function public.submit_online_exam_attempt(
  p_pin text,
  p_student_name text,
  p_student_code text default null,
  p_student_id uuid default null,
  p_nickname text default null,
  p_answers jsonb default '{}'::jsonb,
  p_flagged jsonb default '[]'::jsonb,
  p_live_points integer default 0,
  p_finalize boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.online_exam_sessions%rowtype;
  v_keys jsonb;
  v_strictness text;
  v_q jsonb;
  v_q_num text;
  v_q_type text;
  v_pts numeric(8,2);
  v_score numeric(8,2) := 0;
  v_max_score numeric(8,2) := 0;
  v_ans jsonb;
  v_correct_single text;
  v_expected_multi text[];
  v_actual_multi text[];
  v_accepted_elem text;
  v_ans_norm text;
  v_matched boolean;
  v_safe_name text := trim(coalesce(p_student_name, ''));
  v_safe_code text := nullif(trim(coalesce(p_student_code, '')), '');
  v_safe_student_id uuid := null;
  v_identity_key text;
  v_submission_id uuid;
  v_existing_submitted_at timestamptz := null;
  v_safe_live_points integer := 0;
  v_leaderboard jsonb := '[]'::jsonb;
begin
  if v_safe_name = '' then
    raise exception 'student_name_required';
  end if;

  select *
  into v_session
  from public.online_exam_sessions
  where pin_code = trim(coalesce(p_pin, ''))
  limit 1;

  if v_session.id is null then
    raise exception 'exam_session_not_found';
  end if;

  if v_session.status = 'closed' then
    raise exception 'exam_session_closed';
  end if;

  if p_student_id is not null then
    select id into v_safe_student_id
    from public.students
    where id = p_student_id
      and workspace_id = v_session.workspace_id
    limit 1;
  end if;

  v_keys := coalesce(v_session.answer_key_payload, '{}'::jsonb);
  v_strictness := coalesce(v_keys ->> 'strictness', 'normal');

  for v_q in
    select value
    from jsonb_array_elements(coalesce(v_keys -> 'questions', '[]'::jsonb))
  loop
    v_q_num := coalesce(v_q ->> 'number', '');
    v_q_type := coalesce(v_q ->> 'type', 'single_choice');
    v_pts := coalesce((v_q ->> 'points')::numeric, 1);
    v_max_score := v_max_score + v_pts;
    v_ans := p_answers -> v_q_num;

    if v_ans is null or jsonb_typeof(v_ans) = 'null' then
      continue;
    end if;

    if v_q_type = 'single_choice' then
      v_correct_single := upper(trim(coalesce(v_q ->> 'correctChoice', '')));
      if v_correct_single <> '' and upper(trim(coalesce(p_answers ->> v_q_num, ''))) = v_correct_single then
        v_score := v_score + v_pts;
      end if;
    elsif v_q_type = 'multiple_choice' then
      select coalesce(array_agg(upper(trim(val)) order by upper(trim(val))), array[]::text[])
      into v_expected_multi
      from jsonb_array_elements_text(coalesce(v_q -> 'correctChoices', '[]'::jsonb)) as val
      where trim(val) <> '';

      if jsonb_typeof(v_ans) = 'array' then
        select coalesce(array_agg(upper(trim(val)) order by upper(trim(val))), array[]::text[])
        into v_actual_multi
        from jsonb_array_elements_text(v_ans) as val
        where trim(val) <> '';
      else
        v_actual_multi := array[upper(trim(coalesce(p_answers ->> v_q_num, '')))];
      end if;

      if cardinality(v_expected_multi) > 0 and v_expected_multi = v_actual_multi then
        v_score := v_score + v_pts;
      end if;
    elsif v_q_type = 'short_answer' then
      v_ans_norm := public.normalize_exam_answer_text(p_answers ->> v_q_num, v_strictness);
      v_matched := false;
      if v_ans_norm <> '' then
        for v_accepted_elem in
          select val
          from jsonb_array_elements_text(coalesce(v_q -> 'acceptedTextAnswers', '[]'::jsonb)) as val
        loop
          if public.normalize_exam_answer_text(v_accepted_elem, v_strictness) = v_ans_norm then
            v_matched := true;
            exit;
          end if;
        end loop;
      end if;
      if v_matched then
        v_score := v_score + v_pts;
      end if;
    end if;
  end loop;

  -- Bound live quiz speed points strictly by server-verified correct score (max 1000 points per earned score point)
  v_safe_live_points := least(
    greatest(0, coalesce(p_live_points, 0)),
    greatest(0, ceil(v_score)::integer * 1000)
  );

  v_identity_key := lower(trim(coalesce(v_safe_code, v_safe_name)));

  select id, submitted_at
  into v_submission_id, v_existing_submitted_at
  from public.online_exam_submissions
  where session_id = v_session.id
    and lower(trim(coalesce(nullif(student_code, ''), student_name))) = v_identity_key
  limit 1;

  if v_submission_id is not null and v_existing_submitted_at is not null then
    raise exception 'exam_already_submitted';
  end if;

  if v_submission_id is null then
    insert into public.online_exam_submissions (
      workspace_id,
      session_id,
      student_id,
      student_code,
      student_name,
      nickname,
      answers,
      flagged_questions,
      score,
      max_score,
      live_points,
      submitted_at
    )
    values (
      v_session.workspace_id,
      v_session.id,
      v_safe_student_id,
      v_safe_code,
      v_safe_name,
      nullif(trim(coalesce(p_nickname, '')), ''),
      coalesce(p_answers, '{}'::jsonb),
      coalesce(p_flagged, '[]'::jsonb),
      v_score,
      v_max_score,
      v_safe_live_points,
      case when p_finalize then now() else null end
    )
    returning id into v_submission_id;
  else
    update public.online_exam_submissions
    set
      student_id = coalesce(v_safe_student_id, student_id),
      student_name = v_safe_name,
      nickname = coalesce(nullif(trim(coalesce(p_nickname, '')), ''), nickname),
      answers = coalesce(p_answers, '{}'::jsonb),
      flagged_questions = coalesce(p_flagged, '[]'::jsonb),
      score = v_score,
      max_score = v_max_score,
      live_points = greatest(live_points, v_safe_live_points),
      submitted_at = case when p_finalize then coalesce(submitted_at, now()) else submitted_at end
    where id = v_submission_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'submission_id', sub.id,
        'display_name', coalesce(nullif(sub.nickname, ''), sub.student_name),
        'live_points', sub.live_points,
        'score', sub.score
      )
      order by sub.live_points desc, sub.score desc, sub.created_at asc
    ),
    '[]'::jsonb
  )
  into v_leaderboard
  from (
    select id, nickname, student_name, live_points, score, created_at
    from public.online_exam_submissions
    where session_id = v_session.id
    order by live_points desc, score desc, created_at asc
    limit 10
  ) sub;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'score', case when v_session.show_score_immediately then v_score else null end,
    'max_score', v_max_score,
    'live_points', v_safe_live_points,
    'leaderboard', v_leaderboard
  );
end;
$$;

revoke all on function public.submit_online_exam_attempt(text, text, text, uuid, text, jsonb, jsonb, integer, boolean) from public;
grant execute on function public.submit_online_exam_attempt(text, text, text, uuid, text, jsonb, jsonb, integer, boolean) to anon, authenticated;

-- =====================================================================
-- 5. Lock search_path & Execution Privileges on Post-0061 SECURITY DEFINER Functions
-- =====================================================================
alter function public.set_workspace_ai_key(uuid, text, text) set search_path = public;
revoke all on function public.set_workspace_ai_key(uuid, text, text) from public, anon;
grant execute on function public.set_workspace_ai_key(uuid, text, text) to authenticated;

alter function public.set_profile_ai_key(uuid, text, text) set search_path = public;
revoke all on function public.set_profile_ai_key(uuid, text, text) from public, anon;
grant execute on function public.set_profile_ai_key(uuid, text, text) to authenticated;

alter function public.trim_teacher_exams_quota() set search_path = public;
revoke all on function public.trim_teacher_exams_quota() from public, anon;

notify pgrst, 'reload schema';
