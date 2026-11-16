-- 0086_clean_october_erroneous_savings_deposits.sql
-- Zero out accidental October 2026 savings deposit entries for student #1 (2428) and student #2 (2429),
-- remove phantom reversal/superseded records, restore proper opening balances, and recalculate account balances.

do $$
declare
  s1_id uuid;
  s2_id uuid;
  ws_id uuid;
begin
  -- Find student IDs for 2428 (ณัฏฐชัย สุกใสย์) and 2429 (ณัฐพัฒน์ อินทนู)
  select id, workspace_id into s1_id, ws_id
  from public.students
  where student_code = '2428' or first_name ilike '%ณัฏฐชัย%'
  order by created_at desc
  limit 1;

  select id into s2_id
  from public.students
  where student_code = '2429' or first_name ilike '%ณัฐพัฒน์%'
  order by created_at desc
  limit 1;

  -- 1. Student #1 (2428): เด็กชายณัฏฐชัย สุกใสย์
  if s1_id is not null then
    -- Delete accidental October 2026 deposits and any reversals/realignments
    delete from public.savings_transactions
    where student_id = s1_id
      and (
        (transaction_date >= '2026-10-01' and transaction_date <= '2026-10-31')
        or metadata->>'correction_role' = 'reversal'
        or note ilike '%ย้อนรายการเดิม%'
      );

    -- Ensure opening balance is set to 2896 in savings_accounts
    update public.savings_accounts
    set
      balance = 2896,
      metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{opening_balance}', '2896'::jsonb)
    where student_id = s1_id;
  end if;

  -- 2. Student #2 (2429): เด็กชายณัฐพัฒน์ อินทนู
  if s2_id is not null then
    -- Delete accidental October 2026 deposits and any reversals/realignments
    delete from public.savings_transactions
    where student_id = s2_id
      and (
        (transaction_date >= '2026-10-01' and transaction_date <= '2026-10-31')
        or metadata->>'correction_role' = 'reversal'
        or note ilike '%ย้อนรายการเดิม%'
        or (transaction_type = 'withdrawal' and amount = 2983)
      );

    -- Ensure opening balance is set to 3013 in savings_accounts
    update public.savings_accounts
    set
      balance = 3013,
      metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{opening_balance}', '3013'::jsonb)
    where student_id = s2_id;

    -- If there's an adjustment/opening transaction for student 2, ensure it has amount 3013
    update public.savings_transactions
    set amount = 3013
    where student_id = s2_id
      and (
        transaction_type = 'adjustment'
        or (metadata->>'is_opening_balance')::boolean = true
        or note ilike '%เปิดบัญชีต้นงวด%'
        or note ilike '%ยอดยกมา%'
      );
  end if;

  -- 3. Resynchronize balance for all savings accounts in the workspace
  -- Formula: balance = opening_balance + sum(active deposits) - sum(active withdrawals)
  if ws_id is not null then
    update public.savings_accounts sa
    set balance = greatest(
      0,
      coalesce((sa.metadata->>'opening_balance')::numeric, 0)
      + coalesce((
          select sum(
            case
              when st.transaction_type = 'withdrawal' then -st.amount
              when st.transaction_type = 'deposit' then st.amount
              else 0
            end
          )
          from public.savings_transactions st
          where st.account_id = sa.id
            and st.transaction_type in ('deposit', 'withdrawal')
            and coalesce(st.metadata->>'correction_role', '') <> 'reversal'
            and not (st.metadata ? 'correction_id')
        ), 0)
    )
    where sa.workspace_id = ws_id;
  end if;
end $$;

-- 4. Create RPC for on-demand balance reconciliation
create or replace function public.resync_savings_account_balances(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null
    or not public.can_use_module(target_workspace_id, 'savings')
    or not public.has_workspace_capability(target_workspace_id, 'savings.write') then
    raise exception 'savings_resync_not_allowed';
  end if;

  update public.savings_accounts sa
  set balance = greatest(
    0,
    coalesce((sa.metadata->>'opening_balance')::numeric, 0)
    + coalesce((
        select sum(
          case
            when st.transaction_type = 'withdrawal' then -st.amount
            when st.transaction_type = 'deposit' then st.amount
            else 0
          end
        )
        from public.savings_transactions st
        where st.account_id = sa.id
          and st.transaction_type in ('deposit', 'withdrawal')
          and coalesce(st.metadata->>'correction_role', '') <> 'reversal'
          and not (st.metadata ? 'correction_id')
      ), 0)
  )
  where sa.workspace_id = target_workspace_id;

  get diagnostics updated_count = row_count;

  return jsonb_build_object(
    'success', true,
    'accounts_updated', updated_count
  );
end;
$$;

revoke all on function public.resync_savings_account_balances(uuid) from public;
grant execute on function public.resync_savings_account_balances(uuid) to authenticated;

notify pgrst, 'reload schema';
