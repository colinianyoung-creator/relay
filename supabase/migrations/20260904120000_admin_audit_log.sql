-- Audit log for admin actions. Two different write paths feed it,
-- matching how admin actions actually reach the database:
--
-- 1. Report status changes and listing deletions go through ordinary
--    client requests as the real authenticated admin (RLS-gated), so a
--    SECURITY DEFINER trigger reading auth.uid() can log them reliably —
--    the trigger fires regardless of whether the client bothers to log
--    anything itself, so it can't be bypassed by a buggy or malicious
--    client.
-- 2. Verify/ban/grant-admin actions go through the admin-update-user edge
--    function using the service-role key — Postgres has no auth.uid()
--    context for a service-role write, so that function inserts its own
--    log entry explicitly, using the caller identity it already validated.
--
-- No INSERT policy is granted to authenticated/anon at all: the only ways a
-- row can be created are the SECURITY DEFINER triggers below or the
-- service-role edge function, both bypassing RLS — an admin can't fabricate
-- or erase their own log entries via a direct client call.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index idx_admin_audit_log_created_at on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "Admins can view the audit log"
  on public.admin_audit_log for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Report status changes (mark resolved / reopen).
create function public.log_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (
      auth.uid(),
      'report_status_changed',
      'listing_report',
      new.id::text,
      jsonb_build_object(
        'from', old.status,
        'to', new.status,
        'listing_id', new.listing_id,
        'listing_title', coalesce((select title from public.listings where id = new.listing_id), new.listing_title_snapshot)
      )
    );
  end if;
  return new;
end;
$$;

create trigger log_report_status_change
  after update on public.listing_reports
  for each row execute function public.log_report_status_change();

-- Listing removal — only logged when the actor is an admin, so a seller
-- deleting their own still-pending listing (a normal, non-admin action)
-- doesn't clutter the log.
create function public.log_admin_listing_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
    values (
      auth.uid(),
      'listing_deleted',
      'listing',
      old.id::text,
      jsonb_build_object(
        'title', old.title,
        'seller_id', old.seller_id,
        'seller_name', (select name from public.profiles where id = old.seller_id)
      )
    );
  end if;
  return old;
end;
$$;

create trigger log_admin_listing_deletion
  after delete on public.listings
  for each row execute function public.log_admin_listing_deletion();
