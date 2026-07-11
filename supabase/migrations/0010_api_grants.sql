-- ClassCare 360 - API grants for new Supabase projects.
-- Supabase projects created with stricter default privileges need explicit grants
-- in addition to RLS policies.

grant usage on schema public to anon, authenticated;

grant select on public.plans to anon, authenticated;
grant select on public.module_entitlements to anon, authenticated;

grant select, insert, update on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
grant select, insert, update on tables to authenticated;

alter default privileges in schema public
grant execute on functions to authenticated;

drop policy if exists "plans_select_public_active" on public.plans;
create policy "plans_select_public_active"
on public.plans
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "module_entitlements_select_public" on public.module_entitlements;
create policy "module_entitlements_select_public"
on public.module_entitlements
for select
to anon, authenticated
using (true);
