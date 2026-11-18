-- Ensure all required Supabase Storage buckets exist with WebP support and complete RLS policies.
-- Fixes "Bucket not found" when saving Payment QR codes or uploading payment slips.

-- 1. payment-qr-codes bucket (SuperAdmin-managed QR images, readable by authenticated users)
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
    'image/webp',
    'image/png',
    'image/jpeg'
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

-- 2. payment-slips bucket (Private sensitive slips uploaded by workspace owners, reviewed by SuperAdmin)
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-slips',
  'payment-slips',
  false,
  10485760,
  array[
    'image/webp',
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_slips_storage_select_owner_or_superadmin" on storage.objects;
create policy "payment_slips_storage_select_owner_or_superadmin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-slips'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner'])
      else false
    end
  )
);

drop policy if exists "payment_slips_storage_insert_workspace_owner" on storage.objects;
create policy "payment_slips_storage_insert_workspace_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-slips'
  and (
    public.is_superadmin()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner'])
      else false
    end
  )
);

drop policy if exists "payment_slips_storage_update_owner_or_superadmin" on storage.objects;
create policy "payment_slips_storage_update_owner_or_superadmin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-slips'
  and (public.is_superadmin() or owner = auth.uid())
)
with check (
  bucket_id = 'payment-slips'
  and (public.is_superadmin() or owner = auth.uid())
);

drop policy if exists "payment_slips_storage_delete_owner_or_superadmin" on storage.objects;
create policy "payment_slips_storage_delete_owner_or_superadmin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-slips'
  and (public.is_superadmin() or owner = auth.uid())
);

-- 3. Ensure home-visit-photos and daily-briefs buckets also exist with WebP support
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'home-visit-photos',
  'home-visit-photos',
  false,
  10485760,
  array[
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'daily-briefs',
  'daily-briefs',
  false,
  10485760,
  array[
    'image/webp',
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
