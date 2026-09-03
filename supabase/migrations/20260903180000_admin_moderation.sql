-- Admin moderation: gives someone somewhere real to actually act on the
-- reports filed via listing_reports, instead of only being queryable by
-- hand. is_admin is a flag on profiles, not a separate role table, since
-- Relay has no broader admin surface yet beyond this.
alter table public.profiles add column is_admin boolean not null default false;

-- Column-level privilege, not just RLS: RLS alone would let any signed-in
-- user flip their own is_admin to true via a normal profile update (the
-- existing "Users can update their own profile" policy has no column
-- restriction). Revoking UPDATE on this one column at the grant level closes
-- that regardless of policy logic — only service_role (which bypasses
-- grants) can change it, e.g. via the SQL editor.
revoke update (is_admin) on public.profiles from authenticated;

-- Reports should survive the listing being removed (that's often exactly
-- the moderation outcome) so there's still a record of what was reported
-- and resolved. Snapshot the title at report time since the FK can no
-- longer guarantee the listing row still exists to read it from.
alter table public.listing_reports
  alter column listing_id drop not null,
  add column listing_title_snapshot text;

alter table public.listing_reports
  drop constraint listing_reports_listing_id_fkey,
  add constraint listing_reports_listing_id_fkey
    foreign key (listing_id) references public.listings(id) on delete set null;

create policy "Admins can view all reports"
  on public.listing_reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "Admins can update report status"
  on public.listing_reports for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "Admins can delete any listing"
  on public.listings for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
