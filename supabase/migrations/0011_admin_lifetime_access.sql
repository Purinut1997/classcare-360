-- ClassCare 360 - admin management and lifetime VIP access.
-- `superadmin_profiles.level` supports:
-- - superadmin: owner/admin manager
-- - admin: system admin with the same app access surface

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'superadmin_profiles_level_check'
      and conrelid = 'public.superadmin_profiles'::regclass
  ) then
    alter table public.superadmin_profiles
      add constraint superadmin_profiles_level_check
      check (level in ('superadmin', 'admin'));
  end if;
end $$;

drop policy if exists "superadmin_profiles_insert_superadmin" on public.superadmin_profiles;
create policy "superadmin_profiles_insert_superadmin"
on public.superadmin_profiles
for insert
to authenticated
with check (
  public.is_superadmin()
  and level in ('superadmin', 'admin')
);

drop policy if exists "superadmin_profiles_update_superadmin" on public.superadmin_profiles;
create policy "superadmin_profiles_update_superadmin"
on public.superadmin_profiles
for update
to authenticated
using (public.is_superadmin())
with check (
  public.is_superadmin()
  and level in ('superadmin', 'admin')
);

drop policy if exists "superadmin_profiles_delete_superadmin" on public.superadmin_profiles;
create policy "superadmin_profiles_delete_superadmin"
on public.superadmin_profiles
for delete
to authenticated
using (public.is_superadmin());
