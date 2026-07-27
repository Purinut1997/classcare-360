-- Add normalize_thai_citizen_id function that was missing
-- This function is required by set_student_public_lookup_identity

create or replace function public.normalize_thai_citizen_id(raw_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(raw_value, ''), '\D', '', 'g')
$$;

grant execute on function public.normalize_thai_citizen_id(text) to authenticated, anon;
