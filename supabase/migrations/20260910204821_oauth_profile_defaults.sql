-- Google/Apple sign-in populates a different set of raw_user_meta_data keys
-- than our own signup form does ("full_name"/"picture" rather than
-- "name"/no avatar at all) — widen the new-user trigger to use whichever
-- the provider actually gave us, so an OAuth signup gets a real display
-- name and photo instead of falling back to their email prefix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;
