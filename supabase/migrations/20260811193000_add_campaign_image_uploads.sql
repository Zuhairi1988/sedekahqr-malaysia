alter table public.emergency_campaign
  add column if not exists image_path text check (image_path is null or char_length(image_path) between 1 and 240);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-images', 'campaign-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload campaign images" on storage.objects;
create policy "Admins upload campaign images"
on storage.objects for insert to authenticated
with check (bucket_id = 'campaign-images' and (select public.is_app_admin()));

drop policy if exists "Admins delete campaign images" on storage.objects;
create policy "Admins delete campaign images"
on storage.objects for delete to authenticated
using (bucket_id = 'campaign-images' and (select public.is_app_admin()));
