-- Store only opt-in, workspace-level daily menu counts. No member IDs or student data.
create table if not exists public.workspace_menu_usage_daily (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usage_date date not null default ((now() at time zone 'Asia/Bangkok')::date),
  menu_key text not null check (menu_key ~ '^[a-z][a-z0-9-]{0,63}$'),
  view_count bigint not null default 0 check (view_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, usage_date, menu_key)
);

alter table public.workspace_menu_usage_daily enable row level security;

drop policy if exists "workspace_menu_usage_daily_owner_select" on public.workspace_menu_usage_daily;
create policy "workspace_menu_usage_daily_owner_select"
on public.workspace_menu_usage_daily
for select
to authenticated
using (
  public.is_superadmin()
  or public.has_workspace_role(workspace_id, array['teacher_owner'])
);

revoke all on public.workspace_menu_usage_daily from anon, authenticated;
grant select on public.workspace_menu_usage_daily to authenticated;

create or replace function public.record_workspace_menu_usage(
  target_workspace_id uuid,
  target_menu_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.is_superadmin()
    or public.has_workspace_role(target_workspace_id, array['teacher_owner', 'teacher_member', 'viewer'])
  ) then
    raise exception 'not_allowed';
  end if;

  if target_menu_key !~ '^[a-z][a-z0-9-]{0,63}$' then
    raise exception 'invalid_menu_key';
  end if;

  delete from public.workspace_menu_usage_daily
  where workspace_id = target_workspace_id
    and usage_date < ((now() at time zone 'Asia/Bangkok')::date - 90);

  insert into public.workspace_menu_usage_daily (workspace_id, usage_date, menu_key, view_count)
  values (target_workspace_id, (now() at time zone 'Asia/Bangkok')::date, target_menu_key, 1)
  on conflict (workspace_id, usage_date, menu_key)
  do update set view_count = public.workspace_menu_usage_daily.view_count + 1,
                updated_at = now();
end;
$$;

revoke all on function public.record_workspace_menu_usage(uuid, text) from public, anon;
grant execute on function public.record_workspace_menu_usage(uuid, text) to authenticated;

notify pgrst, 'reload schema';
