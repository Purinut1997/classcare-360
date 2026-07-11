-- Payment QR storage bucket and policies for Superadmin-managed QR images.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-qr-codes',
  'payment-qr-codes',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_qr_codes_storage_select_authenticated" on storage.objects;
create policy "payment_qr_codes_storage_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-qr-codes'
);

drop policy if exists "payment_qr_codes_storage_insert_superadmin" on storage.objects;
create policy "payment_qr_codes_storage_insert_superadmin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-qr-codes'
  and owner = auth.uid()
  and public.is_superadmin()
);

drop policy if exists "payment_qr_codes_storage_update_superadmin" on storage.objects;
create policy "payment_qr_codes_storage_update_superadmin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-qr-codes'
  and public.is_superadmin()
)
with check (
  bucket_id = 'payment-qr-codes'
  and public.is_superadmin()
);

drop policy if exists "payment_qr_codes_storage_delete_superadmin" on storage.objects;
create policy "payment_qr_codes_storage_delete_superadmin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-qr-codes'
  and public.is_superadmin()
);
