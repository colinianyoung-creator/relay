// Buyer-initiated: turns a pending custom-order invoice into a live Stripe
// Checkout session, created just-in-time rather than when the invoice was
// first sent — a negotiated deal can sit unpaid for days while details get
// finalised, and a Checkout session created that early would likely have
// expired by the time the buyer actually gets to it.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId, successUrl, cancelUrl } = await req.json();
    if (!orderId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'Missing orderId, successUrl or cancelUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, amount, currency, platform_fee_amount, status, bundle_listing_ids, stripe_checkout_session_id')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'This invoice is not addressed to you' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This invoice is no longer payable' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.stripe_checkout_session_id) {
      return new Response(
        JSON.stringify({ error: 'Payment for this invoice is already in progress' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Re-check — things may have changed in the time between the invoice
    // being sent and the buyer getting round to paying it.
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, title, sold_at')
      .in('id', order.bundle_listing_ids ?? []);
    if (listingsError || !listings || listings.length === 0) {
      return new Response(JSON.stringify({ error: 'The listings on this invoice could not be found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listings.some((l) => l.sold_at)) {
      return new Response(
        JSON.stringify({ error: 'One or more items on this invoice has already sold — ask the seller for an updated invoice.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', order.seller_id)
      .single();
    if (sellerError || !seller?.stripe_connect_account_id || !seller.stripe_connect_charges_enabled) {
      return new Response(
        JSON.stringify({ error: "This seller's payouts aren't set up right now — message them instead." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountPence = Math.round(Number(order.amount) * 100);
    const platformFeePence = Math.round(Number(order.platform_fee_amount) * 100);
    const itemNote = listings.length === 1 ? listings[0].title : `${listings.length} items`;

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // One line item for the whole agreed total, not itemized per listing —
    // this is a negotiated figure, not necessarily the sum of the listings'
    // original asking prices, so itemizing at those prices would misstate
    // what was actually agreed.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: String(order.currency).toLowerCase(),
            unit_amount: amountPence,
            product_data: { name: `Relay invoice — ${itemNote}` },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeePence,
        transfer_data: { destination: seller.stripe_connect_account_id },
      },
      metadata: { order_id: order.id },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await supabase.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong starting checkout.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
