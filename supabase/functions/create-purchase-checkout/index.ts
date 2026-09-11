// Creates a Stripe Checkout session for a buyer purchasing a listing
// directly through Relay. Uses a destination charge: the full amount is
// charged to the buyer, Stripe transfers it to the seller's connected
// account, and Relay's cut is taken off the top via application_fee_amount
// — Stripe handles the split, Relay never custodies the funds itself.
//
// As with the listing fee, actual "did they pay" state is set by
// stripe-webhook, never trusted from the client redirect alone.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';

// Relay's cut of each sale. Easy to tune — kept as one constant rather than
// scattered through the codebase.
const PLATFORM_FEE_PERCENT = 5;

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

    const { listingId, successUrl, cancelUrl } = await req.json();
    if (!listingId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'Missing listingId, successUrl or cancelUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, seller_id, title, price, currency, fee_status, sold_at')
      .eq('id', listingId)
      .single();
    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.seller_id === user.id) {
      return new Response(JSON.stringify({ error: "You can't buy your own listing" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.sold_at) {
      return new Response(JSON.stringify({ error: 'This listing has already sold' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.fee_status === 'pending') {
      return new Response(JSON.stringify({ error: 'This listing is not published yet' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.price === null) {
      return new Response(
        JSON.stringify({ error: 'This is a free listing — message the seller to arrange collection.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', listing.seller_id)
      .single();
    if (sellerError || !seller?.stripe_connect_account_id || !seller.stripe_connect_charges_enabled) {
      return new Response(
        JSON.stringify({ error: "This seller hasn't set up payouts yet — message them instead." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountPence = Math.round(listing.price * 100);
    const platformFeePence = Math.round((amountPence * PLATFORM_FEE_PERCENT) / 100);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: listing.price,
        currency: listing.currency,
        platform_fee_amount: platformFeePence / 100,
        status: 'pending',
      })
      .select('id')
      .single();
    if (orderError || !order) {
      console.error(orderError);
      return new Response(JSON.stringify({ error: 'Could not start checkout.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: listing.currency.toLowerCase(),
            unit_amount: amountPence,
            product_data: { name: listing.title },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeePence,
        transfer_data: { destination: seller.stripe_connect_account_id },
      },
      shipping_address_collection: { allowed_countries: ['GB', 'US', 'CA', 'AU', 'NL', 'IE'] },
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
