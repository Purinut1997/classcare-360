-- 0085_direct_savings_transaction_edit.sql
-- Direct in-place editing for savings transactions (date, amount, type, student, note).
-- Eliminates fake reversal/withdrawal entries, removes one-time edit locks, and repairs legacy duplicate rows.

-- 1. Clean up legacy correction triplets in existing data:
do $$
declare
  rev record;
  orig_tx public.savings_transactions%rowtype;
  repl_tx public.savings_transactions%rowtype;
begin
  for rev in
    select id, workspace_id, metadata->>'correction_of' as orig_id
    from public.savings_transactions
    where metadata->>'correction_role' = 'reversal'
  loop
    select * into orig_tx
    from public.savings_transactions
    where id::text = rev.orig_id and workspace_id = rev.workspace_id;

    select * into repl_tx
    from public.savings_transactions
    where metadata->>'correction_of' = rev.orig_id
      and metadata->>'correction_role' = 'replacement'
      and workspace_id = rev.workspace_id;

    if repl_tx.id is not null then
      -- If original was 'adjustment', preserve 'adjustment' on replacement
      if orig_tx.id is not null and orig_tx.transaction_type = 'adjustment' then
        update public.savings_transactions
        set transaction_type = 'adjustment'
        where id = repl_tx.id;
      end if;

      -- Strip correction metadata so it's a clean, directly editable transaction
      update public.savings_transactions
      set metadata = coalesce(metadata, '{}'::jsonb) - 'correction_of' - 'correction_role' - 'correction_id'
      where id = repl_tx.id;

      -- Remove the phantom reversal entry
      delete from public.savings_transactions where id = rev.id;

      -- Remove the superseded original entry
      if orig_tx.id is not null then
        delete from public.savings_transactions where id = orig_tx.id;
      end if;
    else
      -- Cancelled transaction where only original and reversal existed
      delete from public.savings_transactions where id = rev.id;
      if orig_tx.id is not null then
        delete from public.savings_transactions where id = orig_tx.id;
      end if;
    end if;
  end loop;

  -- Clean up any remaining records marked with correction_id without reversal
  update public.savings_transactions
  set metadata = coalesce(metadata, '{}'::jsonb) - 'correction_id' - 'correction_reversal_id' - 'correction_reason'
  where metadata ? 'correction_id';
end $$;

-- 2. Redefine public.correct_savings_transaction with direct in-place update logic
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
  updated_tx public.savings_transactions%rowtype;
  original_signed numeric(12,2);
  replacement_signed numeric(12,2);
  edit_entry jsonb;
  new_metadata jsonb;
begin
  if auth.uid() is null
    or not public.can_use_module(target_workspace_id, 'savings')
    or not public.has_workspace_capability(target_workspace_id, 'savings.write') then
    raise exception 'savings_correction_not_allowed';
  end if;

  if replacement_amount is null or replacement_amount < 0 or replacement_amount > 9999999999.99
    or replacement_amount <> round(replacement_amount, 2)
    or (replacement_amount > 0 and (
      replacement_date is null
      or replacement_type is null or replacement_type not in ('deposit', 'withdrawal', 'adjustment')
    ))
    or nullif(btrim(correction_reason), '') is null then
    raise exception 'savings_correction_invalid_input';
  end if;

  select * into original_tx
  from public.savings_transactions
  where id = target_transaction_id and workspace_id = target_workspace_id
  for update;

  if not found then raise exception 'savings_transaction_not_found'; end if;

  if not public.can_access_student(target_workspace_id, original_tx.student_id)
    or not public.can_access_student(target_workspace_id, replacement_student_id) then
    raise exception 'savings_correction_student_not_allowed';
  end if;

  insert into public.savings_accounts (workspace_id, student_id, balance, status)
  values (target_workspace_id, original_tx.student_id, 0, 'active')
  on conflict (workspace_id, student_id) do nothing;

  if replacement_amount > 0 and replacement_student_id <> original_tx.student_id then
    insert into public.savings_accounts (workspace_id, student_id, balance, status)
    values (target_workspace_id, replacement_student_id, 0, 'active')
    on conflict (workspace_id, student_id) do nothing;
  end if;

  perform 1 from public.savings_accounts
  where workspace_id = target_workspace_id
    and student_id in (original_tx.student_id, replacement_student_id)
  order by student_id
  for update;

  select * into source_account from public.savings_accounts
  where workspace_id = target_workspace_id and student_id = original_tx.student_id;

  if replacement_student_id <> original_tx.student_id then
    select * into target_account from public.savings_accounts
    where workspace_id = target_workspace_id and student_id = replacement_student_id;
  else
    target_account := source_account;
  end if;

  original_signed := case original_tx.transaction_type
    when 'withdrawal' then -original_tx.amount
    else original_tx.amount
  end;

  replacement_signed := case
    when replacement_amount = 0 then 0
    when replacement_type = 'withdrawal' then -replacement_amount
    else replacement_amount
  end;

  edit_entry := jsonb_build_object(
    'edited_at', now(),
    'edited_by', auth.uid(),
    'reason', btrim(correction_reason),
    'previous_amount', original_tx.amount,
    'previous_date', original_tx.transaction_date,
    'previous_type', original_tx.transaction_type,
    'previous_student_id', original_tx.student_id,
    'previous_note', original_tx.note
  );

  new_metadata := coalesce(original_tx.metadata, '{}'::jsonb);
  new_metadata := new_metadata - 'correction_id' - 'correction_of' - 'correction_role' - 'correction_reversal_id';
  new_metadata := jsonb_set(
    new_metadata,
    '{edit_history}',
    coalesce(new_metadata->'edit_history', '[]'::jsonb) || jsonb_build_array(edit_entry)
  );

  if replacement_amount = 0 then
    -- Cancellation
    if source_account.balance - original_signed < 0 then
      raise exception 'savings_correction_source_balance_insufficient';
    end if;

    update public.savings_accounts
    set balance = balance - original_signed
    where id = source_account.id and workspace_id = target_workspace_id;
    source_account.balance := source_account.balance - original_signed;

    delete from public.savings_transactions
    where id = original_tx.id and workspace_id = target_workspace_id;

    insert into public.audit_logs (
      workspace_id, actor_profile_id, action, entity_table, entity_id, risk_level, metadata
    ) values (
      target_workspace_id, auth.uid(), 'savings_transaction.cancelled', 'savings_transactions', original_tx.id, 'high',
      jsonb_build_object(
        'cancellation_reason', btrim(correction_reason),
        'original_amount', original_tx.amount,
        'original_type', original_tx.transaction_type,
        'student_id', original_tx.student_id
      )
    );

    return jsonb_build_object(
      'action', 'cancelled',
      'original_id', original_tx.id,
      'original', null,
      'reversal', null,
      'replacement', null,
      'source_balance', source_account.balance,
      'target_balance', null
    );
  else
    -- Direct in-place edit ("ย้ายคือย้าย ไม่ใช่มีรายการถอน")
    if original_tx.student_id = replacement_student_id then
      if source_account.balance - original_signed + replacement_signed < 0 then
        raise exception 'savings_correction_would_make_negative';
      end if;

      update public.savings_accounts
      set balance = balance - original_signed + replacement_signed
      where id = source_account.id and workspace_id = target_workspace_id;
      source_account.balance := source_account.balance - original_signed + replacement_signed;
      target_account := source_account;
    else
      if source_account.balance - original_signed < 0 then
        raise exception 'savings_correction_source_balance_insufficient';
      end if;
      if target_account.balance + replacement_signed < 0 then
        raise exception 'savings_correction_target_balance_insufficient';
      end if;

      update public.savings_accounts set balance = balance - original_signed
      where id = source_account.id and workspace_id = target_workspace_id;
      update public.savings_accounts set balance = balance + replacement_signed
      where id = target_account.id and workspace_id = target_workspace_id;

      source_account.balance := source_account.balance - original_signed;
      target_account.balance := target_account.balance + replacement_signed;
    end if;

    update public.savings_transactions
    set
      student_id = replacement_student_id,
      account_id = target_account.id,
      amount = replacement_amount,
      transaction_date = replacement_date,
      transaction_type = replacement_type,
      metadata = new_metadata
    where id = original_tx.id and workspace_id = target_workspace_id
    returning * into updated_tx;

    insert into public.audit_logs (
      workspace_id, actor_profile_id, action, entity_table, entity_id, risk_level, metadata
    ) values (
      target_workspace_id, auth.uid(), 'savings_transaction.edited', 'savings_transactions', original_tx.id, 'high',
      jsonb_build_object(
        'reason', btrim(correction_reason),
        'previous_amount', original_tx.amount,
        'previous_date', original_tx.transaction_date,
        'previous_type', original_tx.transaction_type,
        'new_amount', replacement_amount,
        'new_date', replacement_date,
        'new_type', replacement_type,
        'replacement_student_id', replacement_student_id
      )
    );

    return jsonb_build_object(
      'action', 'updated',
      'original', to_jsonb(updated_tx),
      'reversal', null,
      'replacement', to_jsonb(updated_tx),
      'source_balance', source_account.balance,
      'target_balance', case when replacement_student_id <> original_tx.student_id then target_account.balance else source_account.balance end
    );
  end if;
end;
$$;

revoke all on function public.correct_savings_transaction(uuid, uuid, uuid, numeric, date, text, text) from public;
grant execute on function public.correct_savings_transaction(uuid, uuid, uuid, numeric, date, text, text) to authenticated;

notify pgrst, 'reload schema';
