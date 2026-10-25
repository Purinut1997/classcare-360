-- 0077_restore_duty_system_permissions.sql
-- Restore execute permissions for classroom duty, period locks, and rollover operations
-- that were unintentionally revoked during blanket security hardening in 0061.
-- Also decouples basic classroom duty rosters from the paid behavior module.

-- 1. Restore RPC execution grants for authenticated teachers
grant execute on function public.generate_balanced_duty_range(uuid, uuid, date, date, text) to authenticated;
grant execute on function public.generate_balanced_duty_week(uuid, uuid, date) to authenticated;
grant execute on function public.set_manual_duty_assignment(uuid, uuid, uuid, date, uuid) to authenticated;
grant execute on function public.record_duty_result_v2(uuid, text, uuid, text, jsonb, text[]) to authenticated;
grant execute on function public.record_duty_result(uuid, text, uuid, text) to authenticated;
grant execute on function public.seed_default_duty_tasks(uuid, uuid) to authenticated;

-- 2. Restore operational RPC grants for classroom locks and transitions
grant execute on function public.set_period_lock(uuid, uuid, date, text, text) to authenticated;
grant execute on function public.request_period_unlock(uuid, text) to authenticated;
grant execute on function public.review_period_unlock(uuid, boolean, text) to authenticated;
grant execute on function public.prepare_year_closure(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.approve_year_closure(uuid) to authenticated;
grant execute on function public.execute_year_closure(uuid) to authenticated;
grant execute on function public.undo_year_closure(uuid, text) to authenticated;
grant execute on function public.set_year_transition(uuid, text, uuid, text) to authenticated;

-- 3. Decouple duty.manage from behavior plan requirement in capability check
create or replace function public.has_workspace_capability(
  target_workspace_id uuid,
  capability_key text
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.profile_id = (select auth.uid())
      and wm.status = 'active'
      and coalesce(
        (wm.permissions ->> capability_key)::boolean,
        (public.workspace_capability_defaults(wm.role) ->> capability_key)::boolean,
        false
      )
      and case capability_key
        when 'attendance.write' then public.can_use_module(target_workspace_id, 'attendance')
        when 'scores.write' then public.can_use_module(target_workspace_id, 'scores')
        when 'savings.write' then public.can_use_module(target_workspace_id, 'savings')
        when 'behavior.write' then public.can_use_module(target_workspace_id, 'behavior')
        when 'duty.manage' then true -- Standard classroom duty routine is available to teachers
        when 'student_care.write' then public.can_use_module(target_workspace_id, 'student_care')
        when 'home_visits.write' then public.can_use_module(target_workspace_id, 'home_visits')
        when 'automation.manage' then public.can_use_module(target_workspace_id, 'student_care')
        when 'communications.prepare' then public.can_use_module(target_workspace_id, 'notifications')
        when 'communications.approve' then public.can_use_module(target_workspace_id, 'notifications')
        when 'daily_brief.write' then public.can_use_module(target_workspace_id, 'reports')
        when 'data.bulk' then public.can_use_module(target_workspace_id, 'import_export')
        when 'reports.export' then public.can_use_module(target_workspace_id, 'reports')
          and public.workspace_plan_limit(target_workspace_id, 'reports_export', 0) > 0
        else true
      end
  );
$$;

revoke all on function public.has_workspace_capability(uuid, text) from public;
grant execute on function public.has_workspace_capability(uuid, text) to authenticated;

-- 4. Update duty RLS policies so duty rosters depend on classroom scope rather than behavior module plan
drop policy if exists duty_tasks_scoped_select on public.duty_tasks;
drop policy if exists duty_tasks_scoped_manage on public.duty_tasks;
create policy duty_tasks_scoped_select on public.duty_tasks for select to authenticated
using (
  public.can_access_workspace_scope(workspace_id, classroom_id)
);
create policy duty_tasks_scoped_manage on public.duty_tasks for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);

drop policy if exists duty_weeks_scoped_select on public.duty_weeks;
drop policy if exists duty_weeks_scoped_manage on public.duty_weeks;
create policy duty_weeks_scoped_select on public.duty_weeks for select to authenticated
using (
  public.can_access_workspace_scope(workspace_id, classroom_id)
);
create policy duty_weeks_scoped_manage on public.duty_weeks for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_workspace_scope(workspace_id, classroom_id)
);

drop policy if exists duty_assignments_scoped_select on public.duty_assignments;
drop policy if exists duty_assignments_scoped_manage on public.duty_assignments;
create policy duty_assignments_scoped_select on public.duty_assignments for select to authenticated
using (
  public.can_access_duty_assignment(workspace_id, duty_week_id)
);
create policy duty_assignments_scoped_manage on public.duty_assignments for all to authenticated
using (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_duty_assignment(workspace_id, duty_week_id)
)
with check (
  public.has_workspace_capability(workspace_id, 'duty.manage')
  and public.can_access_duty_assignment(workspace_id, duty_week_id)
);

notify pgrst, 'reload schema';
