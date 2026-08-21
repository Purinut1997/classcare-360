-- Follow-up to 0063: remove PL/pgSQL output-column ambiguity and use the actual classroom lifecycle column.

create or replace function public.add_workspace_member_by_email(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'teacher_member'
)
returns table (
  profile_id uuid, email text, display_name text, role text, status text,
  joined_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  normalized_email text := lower(trim(target_email));
  target_profile public.profiles%rowtype;
begin
  if not public.can_manage_workspace_members(target_workspace_id) then raise exception 'not_allowed'; end if;
  if target_role not in ('teacher_member', 'viewer') then raise exception 'invalid_workspace_member_role'; end if;

  select p.* into target_profile
  from public.profiles p
  where lower(p.email) = normalized_email
  limit 1;
  if target_profile.id is null then raise exception 'profile_not_found'; end if;

  insert into public.workspace_memberships (workspace_id, profile_id, role, status, invited_by, joined_at)
  values (target_workspace_id, target_profile.id, target_role, 'active', (select auth.uid()), now())
  on conflict (workspace_id, profile_id) do update
  set role = excluded.role,
      status = 'active',
      invited_by = (select auth.uid()),
      joined_at = coalesce(public.workspace_memberships.joined_at, now()),
      updated_at = now();

  return query
  select m.profile_id, m.email, m.display_name, m.role, m.status, m.joined_at, m.created_at
  from public.get_workspace_members(target_workspace_id) m
  where m.profile_id = target_profile.id;
end;
$$;

create or replace function public.request_workspace_access(target_workspace_id uuid)
returns table (workspace_id uuid, role text, status text, joined_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare requester_school text; target_school text; target_archived_at timestamptz;
begin
  select lower(trim(coalesce(p.metadata->>'school_name', ''))) into requester_school
  from public.profiles p where p.id = (select auth.uid());
  if requester_school is null or requester_school = '' then raise exception 'profile_school_required'; end if;

  select lower(trim(coalesce(w.school_name, ''))), w.archived_at into target_school, target_archived_at
  from public.workspaces w where w.id = target_workspace_id;
  if target_school is null then raise exception 'workspace_not_found'; end if;
  if target_archived_at is not null then raise exception 'workspace_archived'; end if;
  if target_school <> requester_school then raise exception 'school_mismatch'; end if;

  if exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id and wm.profile_id = (select auth.uid()) and wm.status = 'suspended'
  ) then raise exception 'membership_suspended'; end if;

  insert into public.workspace_memberships (workspace_id, profile_id, role, status, joined_at)
  values (target_workspace_id, (select auth.uid()), 'teacher_member', 'invited', null)
  on conflict (workspace_id, profile_id) do update
  set role = case when public.workspace_memberships.role in ('teacher_owner','parent','student')
      then public.workspace_memberships.role else 'teacher_member' end,
      status = case when public.workspace_memberships.status = 'active' then 'active' else 'invited' end,
      updated_at = now();

  return query
  select wm.workspace_id, wm.role, wm.status, wm.joined_at, wm.created_at
  from public.workspace_memberships wm
  where wm.workspace_id = target_workspace_id and wm.profile_id = (select auth.uid());
end;
$$;

create or replace function public.get_workspace_viewer_report_summary(
  target_workspace_id uuid,
  date_from date,
  date_to date
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if date_from is null or date_to is null or date_from > date_to or date_to - date_from > 731 then
    raise exception 'invalid_report_range' using errcode = '22023';
  end if;
  if not public.has_workspace_capability(target_workspace_id, 'reports.export') then
    raise exception 'reports_not_allowed' using errcode = '42501';
  end if;

  with accessible_students as (
    select s.id from public.students s
    where s.workspace_id = target_workspace_id and s.status = 'active'
      and public.can_access_classroom(s.workspace_id, s.classroom_id)
  ), accessible_classrooms as (
    select c.id from public.classrooms c
    where c.workspace_id = target_workspace_id and c.status = 'active'
      and public.can_access_classroom(c.workspace_id, c.id)
  ), attendance as (
    select count(ar.*)::integer as total,
      count(*) filter (where ar.status = 'present')::integer as present,
      count(*) filter (where ar.status = 'late')::integer as late,
      count(*) filter (where ar.status = 'absent')::integer as absent,
      count(*) filter (where ar.status = 'leave')::integer as leave,
      count(*) filter (where ar.status = 'sick')::integer as sick,
      count(*) filter (where ar.status = 'activity')::integer as activity
    from public.attendance_records ar
    join public.attendance_sessions ats on ats.id = ar.session_id
    join accessible_students s on s.id = ar.student_id
    where ats.workspace_id = target_workspace_id and ats.attendance_date between date_from and date_to
  ), score_stats as (
    select count(distinct a.id)::integer as assessments, count(e.id)::integer as entries,
      coalesce(round(avg(case when a.max_score > 0 and e.score is not null then e.score / a.max_score * 100 end)::numeric, 2), 0) as average_percent
    from public.score_assessments a
    join accessible_classrooms c on c.id = a.classroom_id
    left join public.score_entries e on e.assessment_id = a.id
    where a.workspace_id = target_workspace_id and a.assessment_date between date_from and date_to
  ), savings_stats as (
    select coalesce(sum(sa.balance), 0) as total_balance, count(sa.id)::integer as account_count
    from public.savings_accounts sa join accessible_students s on s.id = sa.student_id
    where sa.workspace_id = target_workspace_id and sa.status = 'active'
  ), behavior_stats as (
    select count(br.id)::integer as record_count, coalesce(sum(br.points), 0) as points
    from public.behavior_records br join accessible_students s on s.id = br.student_id
    where br.workspace_id = target_workspace_id and br.behavior_date between date_from and date_to
  ), health_stats as (
    select count(hr.id)::integer as record_count
    from public.student_health_records hr join accessible_students s on s.id = hr.student_id
    where hr.workspace_id = target_workspace_id and hr.record_date between date_from and date_to
  ), home_visit_stats as (
    select count(hv.id)::integer as visit_count,
      count(*) filter (where hv.status in ('submitted','certified'))::integer as completed
    from public.student_home_visits hv join accessible_students s on s.id = hv.student_id
    where hv.workspace_id = target_workspace_id
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', date_from, 'to', date_to),
    'classroom_count', (select count(*) from accessible_classrooms),
    'student_count', (select count(*) from accessible_students),
    'attendance', jsonb_build_object(
      'total', a.total, 'present', a.present, 'late', a.late, 'absent', a.absent,
      'leave', a.leave, 'sick', a.sick, 'activity', a.activity,
      'present_rate', case when a.total > 0 then round((a.present + a.late)::numeric / a.total * 100, 2) else 0 end
    ),
    'scores', jsonb_build_object('assessment_count', sc.assessments, 'entry_count', sc.entries, 'average_percent', sc.average_percent),
    'savings', jsonb_build_object('account_count', sv.account_count, 'total_balance', sv.total_balance),
    'behavior', jsonb_build_object('record_count', b.record_count, 'points', b.points),
    'health', jsonb_build_object('record_count', h.record_count),
    'home_visits', jsonb_build_object('visit_count', hv.visit_count, 'completed', hv.completed)
  ) into result
  from attendance a cross join score_stats sc cross join savings_stats sv
    cross join behavior_stats b cross join health_stats h cross join home_visit_stats hv;
  return result;
end;
$$;

revoke all on function public.add_workspace_member_by_email(uuid,text,text) from public;
revoke all on function public.request_workspace_access(uuid) from public;
revoke all on function public.get_workspace_viewer_report_summary(uuid,date,date) from public, anon;
grant execute on function public.add_workspace_member_by_email(uuid,text,text) to authenticated;
grant execute on function public.request_workspace_access(uuid) to authenticated;
grant execute on function public.get_workspace_viewer_report_summary(uuid,date,date) to authenticated;

notify pgrst, 'reload schema';
