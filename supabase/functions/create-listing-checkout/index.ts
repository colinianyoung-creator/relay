// Creates a Stripe Checkout session for a flat listing-posting fee.
// The listing itself is inserted client-side (status 'pending') before this
// runs; this function only verifies ownership, creates the Checkout
// session, and stamps the listing with the session id so the webhook can
// find it again. Actual "did they pay" state is set by stripe-webhook, not
// here — never trust the client-side redirect alone for that.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';

const LISTING_FEE_PENCE = 900; // £9 flat, regardless of the listing's own currency

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
      .select('id, seller_id, title, fee_status')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not your listing' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.fee_status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This listing is not awaiting payment' }), {
        status: 409,
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
            currency: 'gbp',
            unit_amount: LISTING_FEE_PENCE,
            product_data: {
              name: 'Relay listing fee',
              description: listing.title,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { listing_id: listingId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await supabase
      .from('listings')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', listingId);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong creating checkout.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
