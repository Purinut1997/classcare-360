-- Contextual support inbox for ClassCare 360 and approved public products.
create extension if not exists pgcrypto;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique default ('CC-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  workspace_id uuid references public.workspaces(id) on delete set null,
  requester_profile_id uuid references public.profiles(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  source text not null default 'classcare' check (source in ('classcare', 'mediaplatform', 'public')),
  category text not null default 'other' check (category in ('account', 'data', 'attendance', 'reports', 'billing', 'feature', 'security', 'other')),
  subject text not null check (char_length(subject) between 3 and 160),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  context jsonb not null default '{}'::jsonb,
  public_access_token_hash text,
  assigned_to uuid references public.profiles(id) on delete set null,
  requester_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('requester', 'admin', 'system', 'public')),
  body text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_queue_idx on public.support_tickets(status, last_message_at desc);
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_profile_id, last_message_at desc);
create index if not exists support_tickets_workspace_idx on public.support_tickets(workspace_id, last_message_at desc);
create index if not exists support_messages_thread_idx on public.support_messages(ticket_id, created_at);
create index if not exists support_status_history_ticket_idx on public.support_status_history(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_status_history enable row level security;

create policy support_tickets_read on public.support_tickets for select to authenticated
using (public.is_superadmin() or requester_profile_id = auth.uid());
create policy support_tickets_create on public.support_tickets for insert to authenticated
with check (requester_profile_id = auth.uid());
create policy support_tickets_admin_update on public.support_tickets for update to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());

create policy support_messages_read on public.support_messages for select to authenticated
using (
  public.is_superadmin() or (
    not is_internal and exists (
      select 1 from public.support_tickets t where t.id = ticket_id and t.requester_profile_id = auth.uid()
    )
  )
);
create policy support_messages_create on public.support_messages for insert to authenticated
with check (
  (public.is_superadmin() and sender_profile_id = auth.uid()) or
  (sender_profile_id = auth.uid() and not is_internal and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.requester_profile_id = auth.uid()
  ))
);
create policy support_history_read on public.support_status_history for select to authenticated
using (public.is_superadmin() or exists (
  select 1 from public.support_tickets t where t.id = ticket_id and t.requester_profile_id = auth.uid()
));
create policy support_history_admin_create on public.support_status_history for insert to authenticated
with check (public.is_superadmin());

create or replace function public.touch_support_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets set last_message_at = new.created_at, updated_at = now(),
    status = case when new.sender_role in ('requester','public') and status in ('resolved','waiting_user') then 'open' else status end
  where id = new.ticket_id;
  return new;
end;
$$;
drop trigger if exists support_message_touch_ticket on public.support_messages;
create trigger support_message_touch_ticket after insert on public.support_messages
for each row execute function public.touch_support_ticket();

create or replace function public.record_support_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.support_status_history(ticket_id, changed_by, from_status, to_status)
    values (new.id, auth.uid(), case when tg_op = 'UPDATE' then old.status else null end, new.status);
  end if;
  return new;
end;
$$;
drop trigger if exists support_ticket_status_history on public.support_tickets;
create trigger support_ticket_status_history after insert or update of status on public.support_tickets
for each row execute function public.record_support_status();

create or replace function public.mark_support_ticket_read(p_ticket_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.is_superadmin() then
    update public.support_tickets set admin_last_read_at = now() where id = p_ticket_id;
  else
    update public.support_tickets set requester_last_read_at = now()
    where id = p_ticket_id and requester_profile_id = auth.uid();
  end if;
  return found;
end;
$$;

create or replace function public.create_public_support_ticket(
  p_name text, p_email text, p_subject text, p_body text,
  p_category text default 'other', p_source text default 'public', p_context jsonb default '{}'::jsonb,
  p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ticket public.support_tickets; v_token text;
begin
  if coalesce(trim(p_honeypot),'') <> '' then raise exception 'invalid_request'; end if;
  if char_length(trim(p_name)) < 2 or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(trim(p_subject)) < 3 or char_length(trim(p_body)) < 4 then raise exception 'invalid_fields'; end if;
  if (select count(*) from public.support_tickets where requester_email = lower(trim(p_email)) and created_at > now() - interval '1 hour') >= 4 then
    raise exception 'rate_limited';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.support_tickets(requester_name, requester_email, subject, category, source, context, public_access_token_hash)
  values (trim(p_name), lower(trim(p_email)), trim(p_subject),
    case when p_category in ('account','data','attendance','reports','billing','feature','security','other') then p_category else 'other' end,
    case when p_source in ('mediaplatform','public') then p_source else 'public' end,
    coalesce(p_context,'{}'::jsonb), encode(digest(v_token, 'sha256'), 'hex')) returning * into v_ticket;
  insert into public.support_messages(ticket_id, sender_role, body) values (v_ticket.id, 'public', trim(p_body));
  return jsonb_build_object('ticket_code', v_ticket.ticket_code, 'access_token', v_token);
end; $$;

create or replace function public.get_public_support_ticket(p_ticket_code text, p_access_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ticket public.support_tickets;
begin
  select * into v_ticket from public.support_tickets where ticket_code = upper(trim(p_ticket_code))
    and public_access_token_hash = encode(digest(p_access_token, 'sha256'), 'hex');
  if v_ticket.id is null then raise exception 'not_found'; end if;
  return jsonb_build_object('ticket', jsonb_build_object('ticket_code',v_ticket.ticket_code,'subject',v_ticket.subject,'status',v_ticket.status,'priority',v_ticket.priority,'created_at',v_ticket.created_at,'last_message_at',v_ticket.last_message_at),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'sender_role',m.sender_role,'created_at',m.created_at) order by m.created_at) from public.support_messages m where m.ticket_id=v_ticket.id and not m.is_internal),'[]'::jsonb));
end; $$;

create or replace function public.reply_public_support_ticket(p_ticket_code text, p_access_token text, p_body text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if char_length(trim(p_body)) < 1 then raise exception 'invalid_fields'; end if;
  select id into v_id from public.support_tickets where ticket_code=upper(trim(p_ticket_code))
    and public_access_token_hash=encode(digest(p_access_token,'sha256'),'hex');
  if v_id is null then raise exception 'not_found'; end if;
  insert into public.support_messages(ticket_id,sender_role,body) values(v_id,'public',trim(p_body)); return true;
end; $$;

revoke all on function public.create_public_support_ticket(text,text,text,text,text,text,jsonb,text) from public;
revoke all on function public.get_public_support_ticket(text,text) from public;
revoke all on function public.reply_public_support_ticket(text,text,text) from public;
grant execute on function public.create_public_support_ticket(text,text,text,text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.get_public_support_ticket(text,text) to anon, authenticated;
grant execute on function public.reply_public_support_ticket(text,text,text) to anon, authenticated;
grant execute on function public.mark_support_ticket_read(uuid) to authenticated;
grant select, insert on public.support_tickets, public.support_messages, public.support_status_history to authenticated;
grant update on public.support_tickets to authenticated;
