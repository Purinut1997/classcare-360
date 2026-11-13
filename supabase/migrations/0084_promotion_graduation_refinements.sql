-- 0084_promotion_graduation_refinements.sql
-- Refines graduation status, student retention transitions, and permissions for academic rollovers.

create or replace function public.set_year_transition(
  target_transition_id uuid,
  next_type text,
  next_classroom_id uuid default null,
  transition_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.student_year_transitions%rowtype;
  c public.academic_year_closures%rowtype;
  next_status text;
begin
  if next_type not in ('promoted','retained','graduated','transferred','inactive') then
    raise exception 'invalid_transition_type';
  end if;

  select * into t from public.student_year_transitions where id = target_transition_id;
  if t.id is null then
    raise exception 'transition_not_found';
  end if;

  select * into c from public.academic_year_closures where id = t.closure_id;
  if c.id is null or c.status not in ('draft','pending_approval') then
    raise exception 'transition_not_editable';
  end if;

  if not (public.is_superadmin() or public.has_workspace_role(t.workspace_id, array['teacher_owner'])) then
    raise exception 'owner_required';
  end if;

  -- Map to legitimate status in public.students (active, graduated, transferred, inactive)
  next_status := case
    when next_type = 'graduated' then 'graduated'
    when next_type = 'transferred' then 'transferred'
    when next_type = 'inactive' then 'inactive'
    else 'active'
  end;

  update public.student_year_transitions
  set transition_type = next_type,
      to_classroom_id = case
        when next_type = 'retained' then coalesce(next_classroom_id, from_classroom_id)
        when next_type in ('graduated', 'transferred', 'inactive') then null
        else coalesce(next_classroom_id, c.target_classroom_id)
      end,
      target_status = next_status,
      note = transition_note
  where id = t.id;

  update public.academic_year_closures
  set summary = (
    select jsonb_build_object(
      'total_students', count(*),
      'promoted', count(*) filter (where transition_type = 'promoted'),
      'retained', count(*) filter (where transition_type = 'retained'),
      'graduated', count(*) filter (where transition_type = 'graduated'),
      'transferred', count(*) filter (where transition_type = 'transferred'),
      'inactive', count(*) filter (where transition_type = 'inactive')
    )
    from public.student_year_transitions
    where closure_id = c.id
  )
  where id = c.id;

  return jsonb_build_object('updated', true, 'transition_type', next_type, 'target_status', next_status);
end $$;

revoke all on function public.set_year_transition(uuid, text, uuid, text) from public;
grant execute on function public.set_year_transition(uuid, text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
