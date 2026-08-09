-- Student health measurements, hygiene inspections, and daily routines.

create table if not exists public.student_health_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  record_type text not null,
  status text not null default 'recorded',
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  bmi numeric(6,2) generated always as (
    case
      when weight_kg is not null and height_cm is not null and height_cm > 0
        then round(weight_kg / power(height_cm / 100.0, 2), 2)
      else null
    end
  ) stored,
  inspection_results jsonb not null default '{}'::jsonb,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_health_records_type_check check (
    record_type in ('growth', 'toothbrushing', 'milk', 'lunch', 'hygiene')
  ),
  constraint student_health_records_status_check check (
    status in ('recorded', 'completed', 'missed', 'exempt', 'normal', 'attention', 'not_checked')
  ),
  constraint student_health_records_weight_check check (weight_kg is null or weight_kg between 1 and 300),
  constraint student_health_records_height_check check (height_cm is null or height_cm between 30 and 250),
  constraint student_health_records_growth_values_check check (
    record_type <> 'growth' or (weight_kg is not null and height_cm is not null)
  ),
  constraint student_health_records_inspection_object_check check (
    jsonb_typeof(inspection_results) = 'object'
  ),
  unique (workspace_id, student_id, record_date, record_type)
);

create index if not exists student_health_records_workspace_date_idx
  on public.student_health_records (workspace_id, record_date desc, record_type);

create index if not exists student_health_records_classroom_date_idx
  on public.student_health_records (workspace_id, classroom_id, record_date desc, record_type);

create index if not exists student_health_records_student_history_idx
  on public.student_health_records (workspace_id, student_id, record_date desc);

drop trigger if exists student_health_records_touch_updated_at on public.student_health_records;
create trigger student_health_records_touch_updated_at
before update on public.student_health_records
for each row execute function public.touch_updated_at();

alter table public.student_health_records enable row level security;

drop policy if exists "student_health_records_select_workspace_staff" on public.student_health_records;
create policy "student_health_records_select_workspace_staff"
on public.student_health_records for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
);

drop policy if exists "student_health_records_insert_workspace_teacher" on public.student_health_records;
create policy "student_health_records_insert_workspace_teacher"
on public.student_health_records for insert
to authenticated
with check (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and recorded_by = auth.uid()
  and exists (
    select 1 from public.students s
    where s.id = student_id
      and s.workspace_id = workspace_id
      and s.classroom_id = classroom_id
      and s.status = 'active'
  )
);

drop policy if exists "student_health_records_update_workspace_teacher" on public.student_health_records;
create policy "student_health_records_update_workspace_teacher"
on public.student_health_records for update
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
)
with check (
  (public.is_superadmin() or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member']))
  and exists (
    select 1 from public.students s
    where s.id = student_id
      and s.workspace_id = workspace_id
      and s.classroom_id = classroom_id
      and s.status = 'active'
  )
);

drop policy if exists "student_health_records_delete_workspace_teacher" on public.student_health_records;
create policy "student_health_records_delete_workspace_teacher"
on public.student_health_records for delete
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner', 'teacher_member'])
);

grant select, insert, update, delete on public.student_health_records to authenticated;

notify pgrst, 'reload schema';
