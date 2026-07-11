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
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "home_visit_photos_select_workspace_teacher_or_owner" on storage.objects;
create policy "home_visit_photos_select_workspace_teacher_or_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'home-visit-photos'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member'])
      else false
    end
  )
);

drop policy if exists "home_visit_photos_insert_workspace_teacher" on storage.objects;
create policy "home_visit_photos_insert_workspace_teacher"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'home-visit-photos'
  and owner = auth.uid()
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (
      public.is_superadmin()
      or public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner', 'teacher_member'])
    )
    else false
  end
);

drop policy if exists "home_visit_photos_update_workspace_teacher_or_owner" on storage.objects;
create policy "home_visit_photos_update_workspace_teacher_or_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'home-visit-photos'
  and (
    public.is_superadmin()
    or owner = auth.uid()
    or case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner'])
      else false
    end
  )
)
with check (
  bucket_id = 'home-visit-photos'
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (
      public.is_superadmin()
      or owner = auth.uid()
      or public.has_workspace_role(split_part(name, '/', 1)::uuid, array['teacher_owner'])
    )
    else false
  end
);

drop policy if exists "home_visit_photos_delete_workspace_owner_or_superadmin" on storage.objects;
create policy "home_visit_photos_delete_workspace_owner_or_superadmin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'home-visit-photos'
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
