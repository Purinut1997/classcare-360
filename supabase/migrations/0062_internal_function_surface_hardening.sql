-- Keep trigger-only functions out of the exposed RPC surface and pin simple utility search paths.

alter function public.auth_profile_id() set search_path = '';
alter function public.normalize_thai_citizen_id(text) set search_path = '';
alter function public.touch_updated_at() set search_path = '';

do $$
declare
  trigger_function record;
begin
  for trigger_function in
    select p.oid::regprocedure::text as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      trigger_function.signature
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
