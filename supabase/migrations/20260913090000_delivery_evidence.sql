-- Real proof for independently-arranged shipping (a photo of a receipt,
-- drop-off slip, or tracking label) rather than a typed reference either
-- side could get wrong. Private bucket — labels/receipts often show home
-- addresses — so access is via signed URL, gated by order membership.

alter table public.order_deliveries add column evidence_paths text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('delivery-evidence', 'delivery-evidence', false)
on conflict (id) do nothing;

create policy "Buyer or seller can upload evidence for their order"
  on storage.objects for insert
  with check (
    bucket_id = 'delivery-evidence'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (auth.uid() = o.buyer_id or auth.uid() = o.seller_id)
    )
  );

create policy "Buyer or seller can view evidence for their order"
  on storage.objects for select
  using (
    bucket_id = 'delivery-evidence'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (auth.uid() = o.buyer_id or auth.uid() = o.seller_id)
    )
  );

create policy "Buyer or seller can delete evidence for their order"
  on storage.objects for delete
  using (
    bucket_id = 'delivery-evidence'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (auth.uid() = o.buyer_id or auth.uid() = o.seller_id)
    )
  );
