-- Correct savings entries without deleting or overwriting the original ledger row.
create or replace function public.correct_savings_transaction(
  target_workspace_id uuid,
  target_transaction_id uuid,
  replacement_student_id uuid,
  replacement_amount numeric,
  replacement_date date,
  replacement_type text,
  correction_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  original_tx public.savings_transactions%rowtype;
  source_account public.savings_accounts%rowtype;
  target_account public.savings_accounts%rowtype;
  reversal_tx public.savings_transactions%rowtype;
  replacement_tx public.savings_transactions%rowtype;
  source_delta numeric(12,2);
  target_delta numeric(12,2);
begin
  if auth.uid() is null
    or not public.can_use_module(target_workspace_id, 'savings')
    or not public.has_workspace_capability(target_workspace_id, 'savings.write') then
    raise exception 'savings_correction_not_allowed';
  end if;

  if replacement_amount is null or replacement_amount <= 0 or replacement_amount > 9999999999.99
    or replacement_amount <> round(replacement_amount, 2)
    or replacement_date is null
    or replacement_type is null or replacement_type not in ('deposit', 'withdrawal')
    or nullif(btrim(correction_reason), '') is null then
    raise exception 'savings_correction_invalid_input';
  end if;

  select * into original_tx
  from public.savings_transactions
  where id = target_transaction_id and workspace_id = target_workspace_id
  for update;

  if not found then raise exception 'savings_transaction_not_found'; end if;
  if original_tx.metadata ? 'correction_id' then raise exception 'savings_transaction_already_corrected'; end if;
  if not public.can_access_student(target_workspace_id, original_tx.student_id)
    or not public.can_access_student(target_workspace_id, replacement_student_id) then
    raise exception 'savings_correction_student_not_allowed';
  end if;

  insert into public.savings_accounts (workspace_id, student_id, balance, status)
  values (target_workspace_id, original_tx.student_id, 0, 'active')
  on conflict (workspace_id, student_id) do nothing;
  insert into public.savings_accounts (workspace_id, student_id, balance, status)
  values (target_workspace_id, replacement_student_id, 0, 'active')
  on conflict (workspace_id, student_id) do nothing;

  perform 1 from public.savings_accounts
  where workspace_id = target_workspace_id
    and student_id in (original_tx.student_id, replacement_student_id)
  order by student_id
  for update;

  select * into source_account from public.savings_accounts
  where workspace_id = target_workspace_id and student_id = original_tx.student_id;
  select * into target_account from public.savings_accounts
  where workspace_id = target_workspace_id and student_id = replacement_student_id;

  source_delta := case original_tx.transaction_type
    when 'withdrawal' then original_tx.amount
    else -original_tx.amount
  end;
  target_delta := case replacement_type when 'withdrawal' then -replacement_amount else replacement_amount end;

  if original_tx.student_id = replacement_student_id then
    if source_account.balance + source_delta + target_delta < 0 then
      raise exception 'savings_correction_would_make_negative';
    end if;
    update public.savings_accounts set balance = balance + source_delta + target_delta
    where id = source_account.id and workspace_id = target_workspace_id;
    source_account.balance := source_account.balance + source_delta + target_delta;
    target_account := source_account;
  else
    if source_account.balance + source_delta < 0 then
      raise exception 'savings_correction_source_balance_insufficient';
    end if;
    if target_account.balance + target_delta < 0 then
      raise exception 'savings_correction_target_balance_insufficient';
    end if;
    update public.savings_accounts set balance = balance + source_delta
    where id = source_account.id and workspace_id = target_workspace_id;
    update public.savings_accounts set balance = balance + target_delta
    where id = target_account.id and workspace_id = target_workspace_id;
    source_account.balance := source_account.balance + source_delta;
    target_account.balance := target_account.balance + target_delta;
  end if;

  insert into public.savings_transactions (
    workspace_id, account_id, student_id, transaction_type, amount, transaction_date, note, recorded_by, metadata
  ) values (
    target_workspace_id, source_account.id, original_tx.student_id,
    case when original_tx.transaction_type = 'withdrawal' then 'deposit' else 'withdrawal' end,
    original_tx.amount, original_tx.transaction_date,
    'ย้อนรายการเดิม: ' || btrim(correction_reason), auth.uid(),
    jsonb_build_object('correction_of', original_tx.id, 'correction_role', 'reversal')
  ) returning * into reversal_tx;

  insert into public.savings_transactions (
    workspace_id, account_id, student_id, transaction_type, amount, transaction_date, note, recorded_by, metadata
  ) values (
    target_workspace_id, target_account.id, replacement_student_id, replacement_type,
    replacement_amount, replacement_date,
    'รายการที่แก้ไขแทน: ' || btrim(correction_reason), auth.uid(),
    jsonb_build_object('correction_of', original_tx.id, 'correction_role', 'replacement')
  ) returning * into replacement_tx;

  update public.savings_transactions
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'correction_id', replacement_tx.id,
    'correction_reversal_id', reversal_tx.id,
    'correction_reason', btrim(correction_reason),
    'corrected_by', auth.uid(),
    'corrected_at', now()
  )
  where id = original_tx.id and workspace_id = target_workspace_id;

  insert into public.audit_logs (
    workspace_id, actor_profile_id, action, entity_table, entity_id, risk_level, metadata
  ) values (
    target_workspace_id, auth.uid(), 'savings_transaction.corrected', 'savings_transactions', original_tx.id, 'high',
    jsonb_build_object(
      'correction_id', replacement_tx.id,
      'correction_reversal_id', reversal_tx.id,
      'correction_reason', btrim(correction_reason),
      'replacement_amount', replacement_amount,
      'replacement_student_id', replacement_student_id,
      'replacement_type', replacement_type
    )
  );

  return jsonb_build_object(
    'original', to_jsonb(original_tx) || jsonb_build_object('metadata', coalesce(original_tx.metadata, '{}'::jsonb) || jsonb_build_object('correction_id', replacement_tx.id, 'correction_reversal_id', reversal_tx.id, 'correction_reason', btrim(correction_reason), 'corrected_by', auth.uid(), 'corrected_at', now())),
    'reversal', to_jsonb(reversal_tx),
    'replacement', to_jsonb(replacement_tx),
    'source_balance', source_account.balance,
    'target_balance', target_account.balance
  );
end;
$$;

revoke all on function public.correct_savings_transaction(uuid, uuid, uuid, numeric, date, text, text) from public;
grant execute on function public.correct_savings_transaction(uuid, uuid, uuid, numeric, date, text, text) to authenticated;

notify pgrst, 'reload schema';
