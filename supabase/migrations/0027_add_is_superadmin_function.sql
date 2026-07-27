-- Add is_superadmin function that was missing
-- This function is required by set_student_public_lookup_identity

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.superadmin_profiles sp
    where sp.profile_id = auth.uid()
      and sp.is_active = true
  );
$$;

grant execute on function public.is_superadmin() to authenticated, anon;
