// Creates a Stripe Checkout session for a buyer purchasing a listing
// directly through Relay. Uses separate charges and transfers: the full
// amount is captured into Relay's own platform balance, and only
// transferred to the seller once the buyer confirms receipt (or the
// auto-release window elapses) — see releaseTransfer.ts. This holds funds
// during the delivery window instead of paying the seller out instantly.
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

    const { listingId, deliveryMethod, shippingAddress, successUrl, cancelUrl } = await req.json();
    if (!listingId || !deliveryMethod || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing listingId, deliveryMethod, successUrl or cancelUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!['collection', 'courier', 'freight'].includes(deliveryMethod)) {
      return new Response(JSON.stringify({ error: 'Invalid delivery method' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (deliveryMethod !== 'collection') {
      if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.postal_code || !shippingAddress?.country) {
        return new Response(JSON.stringify({ error: 'A full shipping address is required for this delivery method.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, seller_id, title, price, currency, fee_status, sold_at, bundle_id, sellable_individually, delivery_methods')
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
    // Mirrors ListingDetail.tsx's isFleetOnly check — a fleet item not
    // marked sellable individually can only be bought as part of its bundle
    // (via a custom invoice), never on its own. The UI already hides Buy
    // Now for these; this is the server-side backstop a direct API call
    // could otherwise bypass.
    if (listing.bundle_id && listing.sellable_individually === false) {
      return new Response(
        JSON.stringify({ error: 'This item is only sold as part of its club gear lot.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
    // A listing with no methods set defaults to courier (matches the
    // client-side fallback and the migration backfill for older listings).
    const supportedMethods = listing.delivery_methods?.length ? listing.delivery_methods : ['courier'];
    if (!supportedMethods.includes(deliveryMethod)) {
      return new Response(
        JSON.stringify({ error: 'This seller does not offer that delivery method for this item.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('name, stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', listing.seller_id)
      .single();
    if (sellerError || !seller?.stripe_connect_account_id || !seller.stripe_connect_charges_enabled) {
      return new Response(
        JSON.stringify({ error: "This seller hasn't set up payouts yet — message them instead." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

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

    // Seed delivery info immediately from what the buyer just chose, rather
    // than waiting on Stripe's own (now-unused) shipping collection — see
    // stripe-webhook.ts, whose equivalent upsert simply becomes a no-op here.
    const { error: deliveryError } = await supabase.from('order_deliveries').upsert(
      {
        order_id: order.id,
        method: deliveryMethod,
        shipping_address: deliveryMethod === 'collection' ? null : shippingAddress,
        shipping_recipient_name: deliveryMethod === 'collection' ? null : buyerProfile?.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    );
    if (deliveryError) console.error(deliveryError);

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
