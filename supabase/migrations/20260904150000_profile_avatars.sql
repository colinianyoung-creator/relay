-- Optional profile picture upload. Same pattern as listing-photos: a
-- public Storage bucket with the uploader's own folder enforced by RLS via
-- the path convention {user_id}/{uuid}.{ext}.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Public read for avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload to their own avatars folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.profiles add column avatar_url text;
