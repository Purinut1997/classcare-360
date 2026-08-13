-- Let SuperAdmins select an existing ClassCare user instead of typing an email.
-- The directory deliberately exposes only the minimum fields needed by the picker.

create or replace function public.list_admin_access_candidates(search_text text default null)
returns table (
  profile_id uuid,
  email text,
  display_name text,
  account_status text,
  current_level text,
  is_admin_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_search text := lower(trim(coalesce(search_text, '')));
begin
  if not public.is_superadmin() then
    raise exception 'not_allowed';
  end if;

  return query
  select
    p.id,
    p.email,
    coalesce(nullif(trim(p.display_name), ''), p.email),
    p.account_status,
    sap.level,
    coalesce(sap.is_active, false)
  from public.profiles p
  left join public.superadmin_profiles sap on sap.profile_id = p.id
  where normalized_search = ''
     or lower(p.email) like '%' || normalized_search || '%'
     or lower(coalesce(p.display_name, '')) like '%' || normalized_search || '%'
  order by coalesce(sap.is_active, false), coalesce(nullif(trim(p.display_name), ''), p.email)
  limit 200;
end;
$$;

revoke all on function public.list_admin_access_candidates(text) from public;
grant execute on function public.list_admin_access_candidates(text) to authenticated;

notify pgrst, 'reload schema';
