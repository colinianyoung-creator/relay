// Source of truth for "did this Checkout session actually get paid", and
// now also for Stripe disputes/chargebacks landing on an order — covers the
// flat listing-posting fee, in-platform purchase checkouts, and dispute
// lifecycle events. Never trust the Checkout success redirect alone for
// payment state — a browser can be closed or the redirect can fail after a
// real payment, so this webhook is what actually flips state.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

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

    if (listingId && session.payment_status === 'paid') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { error } = await supabase
        .from('listings')
        .update({ fee_status: 'paid' })
        .eq('id', listingId)
        .eq('stripe_checkout_session_id', session.id);
      if (error) console.error('Failed to mark listing paid', error);
    }

    if (orderId && session.payment_status === 'paid') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: order, error: orderFetchError } = await supabase
        .from('orders')
        .select('listing_id, buyer_id, seller_id')
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
          const { error: salesCountError } = await supabase.rpc('increment_sales_count', {
            p_seller_id: order.seller_id,
          });
          if (salesCountError) console.error('Failed to increment seller sales_count', salesCountError);
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
