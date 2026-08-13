-- Avoid referencing NEW fields that do not exist on every table sharing this trigger.

create or replace function public.enforce_workspace_plan_resource_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  resource_limit integer;
  current_count integer;
begin
  if tg_table_name = 'classrooms' then
    if new.status = 'active' then
      resource_limit := public.workspace_plan_limit(new.workspace_id, 'active_classrooms', 1);
      select count(*) into current_count from public.classrooms c
      where c.workspace_id = new.workspace_id and c.status = 'active' and c.id <> new.id;
      if current_count >= resource_limit then raise exception 'workspace_classroom_limit_reached'; end if;
    end if;
  elsif tg_table_name = 'students' then
    if new.status = 'active' then
      resource_limit := public.workspace_plan_limit(new.workspace_id, 'active_students', 40);
      select count(*) into current_count from public.students s
      where s.workspace_id = new.workspace_id and s.status = 'active' and s.id <> new.id;
      if current_count >= resource_limit then raise exception 'workspace_student_limit_reached'; end if;
    end if;
  elsif tg_table_name = 'workspace_memberships' then
    if new.status = 'active' and new.role <> 'teacher_owner' then
      resource_limit := public.workspace_plan_limit(new.workspace_id, 'collaborators', 1);
      select count(*) into current_count from public.workspace_memberships wm
      where wm.workspace_id = new.workspace_id and wm.status = 'active'
        and wm.role <> 'teacher_owner' and wm.profile_id <> new.profile_id;
      if current_count >= resource_limit then raise exception 'workspace_collaborator_limit_reached'; end if;
    end if;
  elsif tg_table_name = 'workspace_teacher_invitations' then
    if new.status = 'invited' then
      resource_limit := public.workspace_plan_limit(new.workspace_id, 'collaborators', 1);
      select
        (select count(*) from public.workspace_memberships wm
         where wm.workspace_id = new.workspace_id and wm.status = 'active' and wm.role <> 'teacher_owner')
        +
        (select count(*) from public.workspace_teacher_invitations i
         where i.workspace_id = new.workspace_id and i.status = 'invited' and i.id <> new.id)
      into current_count;
      if current_count >= resource_limit then raise exception 'workspace_collaborator_limit_reached'; end if;
    end if;
  else
    raise exception 'unsupported_plan_limit_table:%', tg_table_name;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
