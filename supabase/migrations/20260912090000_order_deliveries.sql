-- No carrier integration exists yet — this is the seam for it. A buyer or
-- seller can ask for a shipping quote (which nudges the other side via a
-- message to get one externally) and record whatever they actually agreed:
-- method, and a manually-pasted tracking reference/link.

create table public.order_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  method text check (method in ('collection', 'courier', 'freight')),
  quote_requested_at timestamptz,
  quote_requested_by uuid references public.profiles(id),
  tracking_reference text,
  tracking_url text,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.order_deliveries enable row level security;

create policy "Buyer or seller can view their order's delivery info"
  on public.order_deliveries for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (auth.uid() = o.buyer_id or auth.uid() = o.seller_id)
    )
  );
