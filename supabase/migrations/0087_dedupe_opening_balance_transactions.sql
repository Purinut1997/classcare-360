-- 0087_dedupe_opening_balance_transactions.sql
-- Deduplicate opening-balance adjustment transactions (caused by re-saving batch opening balances)
-- and resynchronize savings_accounts.balance = opening_balance + active deposits - active withdrawals.

do $$
declare
  rec record;
begin
  -- 1. Keep only the latest single opening-balance adjustment transaction per (workspace_id, student_id)
  with ranked_openings as (
    select
      id,
      workspace_id,
      student_id,
      row_number() over (
        partition by workspace_id, student_id
        order by created_at desc, id desc
      ) as rn
    from public.savings_transactions
    where transaction_type = 'adjustment'
       or coalesce((metadata->>'is_opening_balance')::boolean, false) = true
       or note ilike '%ยอดยกมา%'
       or note ilike '%เปิดบัญชีต้นงวด%'
  )
  delete from public.savings_transactions
  where id in (select id from ranked_openings where rn > 1);

  -- 2. Sync the remaining opening-balance adjustment amount with savings_accounts.metadata.opening_balance when set
  update public.savings_transactions st
  set amount = (sa.metadata->>'opening_balance')::numeric
  from public.savings_accounts sa
  where st.account_id = sa.id
    and coalesce((sa.metadata->>'opening_balance')::numeric, 0) > 0
    and (
      st.transaction_type = 'adjustment'
      or coalesce((st.metadata->>'is_opening_balance')::boolean, false) = true
      or st.note ilike '%ยอดยกมา%'
      or st.note ilike '%เปิดบัญชีต้นงวด%'
    )
    and st.amount <> (sa.metadata->>'opening_balance')::numeric;

  -- 3. Remove any accidental October 2026 deposits / reversals for student #1 (2428) and #2 (2429)
  delete from public.savings_transactions st
  using public.students s
  where st.student_id = s.id
    and (
      s.student_code in ('2428', '2429')
      or s.first_name ilike '%ณัฏฐชัย%'
      or s.first_name ilike '%ณัฐพัฒน์%'
    )
    and (
      (st.transaction_date >= '2026-10-01' and st.transaction_date <= '2026-10-31')
      or st.metadata->>'correction_role' = 'reversal'
      or st.note ilike '%ย้อนรายการเดิม%'
      or (st.transaction_type = 'withdrawal' and st.amount = 2983)
    );

  -- 4. Recalculate savings_accounts.balance across all accounts that have opening_balance metadata
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
          and not (coalesce((st.metadata->>'is_opening_balance')::boolean, false))
          and coalesce(st.note, '') not ilike '%ยอดยกมา%'
          and coalesce(st.note, '') not ilike '%เปิดบัญชีต้นงวด%'
      ), 0)
  )
  where coalesce((sa.metadata->>'opening_balance')::numeric, 0) > 0;
end $$;

notify pgrst, 'reload schema';
