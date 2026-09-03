-- Real photo uploads for listings, stored in a public Storage bucket.
-- Path convention: {seller_id}/{uuid}-{filename}, so a seller can only
-- write inside their own folder — mirrors the pattern already used for
-- table-level RLS elsewhere in this schema (auth.uid() scoping).

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "Public read for listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "Users can upload to their own listing-photos folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own listing photos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.listings
  add column photos text[] not null default '{}';
