-- Keep one active duty template per visually identical name. Historical assignments remain intact.

with ranked as (
  select
    id,
    row_number() over (
      partition by workspace_id, classroom_id,
        lower(translate(name, ' ' || chr(8203) || chr(8204) || chr(8205) || chr(65279), ''))
      order by is_active desc, created_at, id
    ) as duplicate_rank
  from public.duty_tasks
)
update public.duty_tasks task
set is_active = false,
    updated_at = now()
from ranked
where ranked.id = task.id
  and ranked.duplicate_rank > 1
  and task.is_active;

create unique index if not exists duty_tasks_active_visual_name_unique
on public.duty_tasks (
  workspace_id,
  classroom_id,
  lower(translate(name, ' ' || chr(8203) || chr(8204) || chr(8205) || chr(65279), ''))
)
where is_active;

notify pgrst, 'reload schema';
