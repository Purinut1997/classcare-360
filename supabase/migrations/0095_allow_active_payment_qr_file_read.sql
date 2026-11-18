-- Allow authenticated users to read app_files metadata for active payment QR codes
-- so regular workspace users can load signed URLs and display the active Payment QR image on /app/package.

drop policy if exists "app_files_select_active_payment_qr" on public.app_files;
create policy "app_files_select_active_payment_qr"
on public.app_files
for select
to authenticated
using (
  bucket = 'payment-qr-codes'
  and exists (
    select 1
    from public.payment_qr_codes q
    where q.file_id = app_files.id
      and q.is_active = true
  )
);
