// Source of truth for "did this Checkout session actually get paid", and
// now also for Stripe disputes/chargebacks landing on an order — covers the
// flat listing-posting fee, in-platform purchase checkouts, and dispute
// lifecycle events. Never trust the Checkout success redirect alone for
// payment state — a browser can be closed or the redirect can fail after a
// real payment, so this webhook is what actually flips state.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { sendEmail, formatMoney, SITE_URL } from '../_shared/email.ts';
import { notifyUser } from '../_shared/notify.ts';
import { listingMatchesSearch, type SavedSearch } from '../_shared/matchSearch.ts';

// A listing just went live (paid) — check it against every saved search and
// notify each matching user once. Mirrors check-saved-searches, which
// handles the free/exempt-listing paths where nothing server-side runs
// otherwise; here we're already server-side, so no extra network hop.
async function notifyMatchingSearches(
  supabase: ReturnType<typeof createClient>,
  listings: {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    sport: string;
    condition: string;
    country: string;
    ships_internationally: boolean;
    location: string;
    bundle_id: string | null;
  }[],
) {
  if (listings.length === 0) return;
  try {
    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('user_id, sport, condition, country, min_price, max_price, free_only');
    if (error || !searches) return;

    const matchesByUser = new Map<string, typeof listings>();
    for (const search of searches as (SavedSearch & { user_id: string })[]) {
      for (const listing of listings) {
        if (listingMatchesSearch(listing, search)) {
          const existing = matchesByUser.get(search.user_id) ?? [];
          if (!existing.some((l) => l.id === listing.id)) existing.push(listing);
          matchesByUser.set(search.user_id, existing);
        }
      }
    }

    for (const [userId, matched] of matchesByUser) {
      const items = matched
        .map((l) => {
          const link = l.bundle_id ? `${SITE_URL}/fleet/${l.bundle_id}` : `${SITE_URL}/listing/${l.id}`;
          return `<li><a href="${link}">${l.title}</a> — ${formatMoney(l.price ?? 0, l.currency)}, ${l.location}</li>`;
        })
        .join('');
      await notifyUser(
        supabase,
        userId,
        matched.length === 1 ? 'New listing matches your saved search' : 'New listings match your saved search',
        `<p>Something new just went live that matches one of your saved searches:</p><ul>${items}</ul>`,
      );
    }
  } catch (err) {
    console.error('notifyMatchingSearches failed', err);
  }
}

// Fires once a sale has genuinely completed (order paid, listing(s) actually
// transferred) — covers both an instant single-listing purchase and a paid
// custom-order invoice, since both share this same completion path. Never
// throws: an email problem must not turn an already-successful DB write
// into a webhook failure Stripe would retry.
async function sendOrderEmails(
  supabase: ReturnType<typeof createClient>,
  order: {
    listing_id: string | null;
    bundle_id: string | null;
    bundle_listing_ids: string[] | null;
    buyer_id: string;
    seller_id: string;
    amount: number;
    currency: string;
    platform_fee_amount: number;
  },
  orderId: string,
) {
  try {
    const [{ data: profiles }, buyerAuth, sellerAuth] = await Promise.all([
      supabase.from('profiles').select('id, name').in('id', [order.buyer_id, order.seller_id]),
      supabase.auth.admin.getUserById(order.buyer_id),
      supabase.auth.admin.getUserById(order.seller_id),
    ]);

    const buyerName = profiles?.find((p) => p.id === order.buyer_id)?.name ?? 'there';
    const sellerName = profiles?.find((p) => p.id === order.seller_id)?.name ?? 'there';
    const buyerEmail = buyerAuth.data.user?.email;
    const sellerEmail = sellerAuth.data.user?.email;

    const isMultiItem = !!order.bundle_listing_ids && order.bundle_listing_ids.length > 0;
    let itemLabel: string;
    let buyerLink: string;

    if (isMultiItem) {
      if (order.bundle_id) {
        const { data: bundle } = await supabase
          .from('listing_bundles')
          .select('title')
          .eq('id', order.bundle_id)
          .single();
        itemLabel = bundle?.title ?? `${order.bundle_listing_ids!.length} items`;
      } else {
        itemLabel = `${order.bundle_listing_ids!.length} items`;
      }
      buyerLink = order.bundle_id ? `${SITE_URL}/fleet/${order.bundle_id}` : `${SITE_URL}/account`;
    } else {
      const { data: listing } = await supabase
        .from('listings')
        .select('title')
        .eq('id', order.listing_id)
        .single();
      itemLabel = listing?.title ?? 'your item';
      buyerLink = `${SITE_URL}/listing/${order.listing_id}`;
    }

    const sellerLink = isMultiItem ? `${SITE_URL}/account?tab=invoices` : `${SITE_URL}/account`;
    const amountStr = formatMoney(order.amount, order.currency);
    const payoutStr = formatMoney(order.amount - order.platform_fee_amount, order.currency);

    if (buyerEmail) {
      await sendEmail({
        to: buyerEmail,
        subject: `Order confirmed — ${itemLabel}`,
        html: `
          <p>Hi ${buyerName},</p>
          <p>Your payment of <strong>${amountStr}</strong> for "<strong>${itemLabel}</strong>" from ${sellerName} is confirmed.</p>
          <p><a href="${buyerLink}">View it on Relay</a></p>
          <p>Relay doesn't arrange shipping or collection — sort the details directly with ${sellerName} via Relay messages.</p>
          <p>— Relay</p>
        `,
      });
    } else {
      console.error('No buyer email found for order', orderId);
    }

    if (sellerEmail) {
      await sendEmail({
        to: sellerEmail,
        subject: `You've made a sale on Relay — ${itemLabel}`,
        html: `
          <p>Hi ${sellerName},</p>
          <p>${buyerName} just bought "<strong>${itemLabel}</strong>" for ${amountStr}.</p>
          <p>Your payout, after Relay's platform fee, is <strong>${payoutStr}</strong> — it'll follow automatically once Stripe settles the transfer to your connected account.</p>
          <p><a href="${sellerLink}">View in your account</a></p>
          <p>— Relay</p>
        `,
      });
    } else {
      console.error('No seller email found for order', orderId);
    }
  } catch (err) {
    console.error('Failed to send order confirmation emails for order', orderId, err);
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingId = session.metadata?.listing_id;
    const orderId = session.metadata?.order_id;
    const fleetBundleId = session.metadata?.bundle_id;

    if (fleetBundleId && session.payment_status === 'paid') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: bundle, error: bundleFetchError } = await supabase
        .from('listing_bundles')
        .select('id')
        .eq('id', fleetBundleId)
        .eq('stripe_checkout_session_id', session.id)
        .single();

      if (bundleFetchError || !bundle) {
        console.error('Fleet bundle not found for completed session', fleetBundleId, bundleFetchError);
      } else {
        const { data: updatedFleetListings, error: listingsUpdateError } = await supabase
          .from('listings')
          .update({ fee_status: 'paid' })
          .eq('bundle_id', fleetBundleId)
          .eq('fee_status', 'pending')
          .select('id, title, price, currency, sport, condition, country, ships_internationally, location, bundle_id');
        if (listingsUpdateError) console.error('Failed to mark fleet listings paid', listingsUpdateError);
        else await notifyMatchingSearches(supabase, updatedFleetListings ?? []);

        const { error: bundleUpdateError } = await supabase
          .from('listing_bundles')
          .update({ status: 'active' })
          .eq('id', fleetBundleId);
        if (bundleUpdateError) console.error('Failed to activate fleet bundle', bundleUpdateError);
      }
    }

    if (listingId && session.payment_status === 'paid') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: updatedListing, error } = await supabase
        .from('listings')
        .update({ fee_status: 'paid' })
        .eq('id', listingId)
        .eq('stripe_checkout_session_id', session.id)
        .select('id, title, price, currency, sport, condition, country, ships_internationally, location, bundle_id')
        .single();
      if (error) console.error('Failed to mark listing paid', error);
      else await notifyMatchingSearches(supabase, [updatedListing]);
    }

    if (orderId && session.payment_status === 'paid') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: order, error: orderFetchError } = await supabase
        .from('orders')
        .select('listing_id, bundle_id, bundle_listing_ids, buyer_id, seller_id, amount, currency, platform_fee_amount')
        .eq('id', orderId)
        .eq('stripe_checkout_session_id', session.id)
        .single();

      if (orderFetchError || !order) {
        console.error('Order not found for completed session', orderId, orderFetchError);
      } else {
        const paymentIntentId =
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ status: 'paid', stripe_payment_intent_id: paymentIntentId ?? null })
          .eq('id', orderId);
        if (orderUpdateError) console.error('Failed to mark order paid', orderUpdateError);

        // Buyer's shipping address, if Checkout collected one — sits
        // alongside the delivery-method/tracking info a seller records later.
        if (session.shipping_details?.address) {
          const { error: shippingError } = await supabase.from('order_deliveries').upsert(
            {
              order_id: orderId,
              shipping_address: session.shipping_details.address,
              shipping_recipient_name: session.shipping_details.name ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'order_id' },
          );
          if (shippingError) console.error('Failed to save shipping address', shippingError);
        }

        let soldCount = 0;
        let soldListingIds: string[] = [];

        if (order.bundle_listing_ids && order.bundle_listing_ids.length > 0) {
          // Multi-item order (fleet bundle purchase or a one-off negotiated
          // invoice covering several listings) — mark every listing sold in
          // one go, same race-guard style as the single-listing path below.
          const targetIds = order.bundle_listing_ids;
          const { data: updatedListings, error: listingUpdateError } = await supabase
            .from('listings')
            .update({ sold_at: new Date().toISOString(), buyer_id: order.buyer_id })
            .in('id', targetIds)
            .is('sold_at', null)
            .select('id');
          if (listingUpdateError) console.error('Failed to mark bundle listings sold', listingUpdateError);
          else if (!updatedListings || updatedListings.length < targetIds.length) {
            console.error(
              'Some listings in order',
              orderId,
              'were already sold when it completed — needs manual refund review',
            );
          }

          // Only a /fleets-sourced order has a formal bundle to close out —
          // a one-off invoice not tied to a browsable bundle has none.
          if (order.bundle_id) {
            const { error: bundleStatusError } = await supabase
              .from('listing_bundles')
              .update({ status: 'sold' })
              .eq('id', order.bundle_id);
            if (bundleStatusError) console.error('Failed to mark bundle sold', bundleStatusError);
          }

          if (updatedListings && updatedListings.length > 0) {
            soldCount = updatedListings.length;
            soldListingIds = updatedListings.map((l) => l.id);
            const { error: salesCountError } = await supabase.rpc('increment_sales_count', {
              p_seller_id: order.seller_id,
              p_count: updatedListings.length,
            });
            if (salesCountError) console.error('Failed to increment seller sales_count', salesCountError);
          }
        } else {
          // Guard against a listing already sold by a race between two
          // checkout sessions — only the first completed payment wins here.
          // A losing second payment isn't auto-refunded in this prototype.
          const { data: updatedListings, error: listingUpdateError } = await supabase
            .from('listings')
            .update({ sold_at: new Date().toISOString(), buyer_id: order.buyer_id })
            .eq('id', order.listing_id)
            .is('sold_at', null)
            .select('id');
          if (listingUpdateError) console.error('Failed to mark listing sold', listingUpdateError);
          else if (!updatedListings || updatedListings.length === 0) {
            console.error('Listing was already sold when order', orderId, 'completed — needs manual refund review');
          } else {
            soldCount = updatedListings.length;
            soldListingIds = updatedListings.map((l) => l.id);
            const { error: salesCountError } = await supabase.rpc('increment_sales_count', {
              p_seller_id: order.seller_id,
            });
            if (salesCountError) console.error('Failed to increment seller sales_count', salesCountError);
          }
        }

        // A listing that just sold may have other pending orders sitting
        // against it — an abandoned Buy now attempt, or a still-open offer
        // negotiation that was never accepted. Those can never be fulfilled
        // now, so leaving them "pending" would show the same listing as
        // both paid and still-owed in the buyer's and seller's Orders tabs.
        if (soldListingIds.length > 0) {
          const idList = soldListingIds.join(',');
          const { error: cancelStaleError } = await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('status', 'pending')
            .neq('id', orderId)
            .or(`listing_id.in.(${idList}),bundle_listing_ids.ov.{${idList}}`);
          if (cancelStaleError) {
            console.error('Failed to cancel stale pending orders for sold listing(s)', cancelStaleError);
          }

          // Same problem, different table — an open offer negotiation on a
          // listing that just sold elsewhere can never be accepted now.
          const { error: declineStaleOffersError } = await supabase
            .from('offers')
            .update({ status: 'declined' })
            .eq('status', 'pending')
            .in('listing_id', soldListingIds);
          if (declineStaleOffersError) {
            console.error('Failed to decline stale pending offers for sold listing(s)', declineStaleOffersError);
          }
        }

        // Only notify once we know the listing(s) actually transferred —
        // not on the race-guard "already sold" path, which leaves this
        // payment needing manual refund review rather than a normal sale.
        if (soldCount > 0) {
          await sendOrderEmails(supabase, order, orderId);
        }
      }
    }
  }

  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId =
      typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;

    if (paymentIntentId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { error } = await supabase
        .from('orders')
        .update({
          disputed_at: new Date(dispute.created * 1000).toISOString(),
          dispute_status: dispute.status,
        })
        .eq('stripe_payment_intent_id', paymentIntentId);
      if (error) console.error('Failed to record dispute', error);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
