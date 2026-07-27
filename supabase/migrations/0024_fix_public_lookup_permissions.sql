-- Fix public lookup RPC function permissions
-- Ensure set_student_public_lookup_identity function exists and has proper grants

-- Recreate the function to ensure it exists
create or replace function public.set_student_public_lookup_identity(
  target_student_id uuid,
  citizen_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
  student_record record;
  normalized_id text := public.normalize_thai_citizen_id(citizen_id);
  lookup_hash text;
begin
  if current_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(normalized_id) <> 13 then
    raise exception 'Citizen id must contain 13 digits' using errcode = '22023';
  end if;

  select id, workspace_id, birth_date, metadata
    into student_record
  from public.students
  where id = target_student_id;

  if student_record.id is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if student_record.birth_date is null then
    raise exception 'Student birth_date is required before public lookup can be enabled' using errcode = '22023';
  end if;

  if not (
    public.is_superadmin(current_profile_id)
    or public.has_workspace_role(student_record.workspace_id, array['teacher_owner', 'teacher_member'])
  ) then
    raise exception 'Only teacher or superadmin can set lookup identity' using errcode = '42501';
  end if;

  lookup_hash := public.public_lookup_hash(student_record.workspace_id, student_record.birth_date, normalized_id);

  update public.students
  set metadata = jsonb_set(
      jsonb_set(coalesce(metadata, '{}'::jsonb), '{public_lookup_id_hash}', to_jsonb(lookup_hash), true),
      '{public_lookup_last4}',
      to_jsonb(right(normalized_id, 4)),
      true
    ),
    updated_at = now()
  where id = target_student_id;

  insert into public.audit_logs (
    action,
    actor_profile_id,
    actor_role,
    entity_id,
    entity_table,
    metadata,
    workspace_id
  )
  values (
    'public_report.identity_hash_set',
    current_profile_id,
    'teacher_member',
    target_student_id,
    'students',
    jsonb_build_object('last4', right(normalized_id, 4)),
    student_record.workspace_id
  );

  return jsonb_build_object('ok', true, 'student_id', target_student_id, 'last4', right(normalized_id, 4));
end;
$$;

-- Ensure proper grants
grant execute on function public.set_student_public_lookup_identity(uuid, text) to authenticated;
