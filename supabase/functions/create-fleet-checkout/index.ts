// Creates ONE Stripe Checkout session covering the flat posting fee for
// every listing in a fleet bundle, so a seller listing 12 chairs at once
// pays and gets redirected once, not 12 times. The bundle and its listings
// are inserted client-side (bundle 'draft', listings fee_status 'pending')
// before this runs; this function only verifies ownership, creates the
// Checkout session, and stamps the session id on the bundle so the webhook
// can find it again. Actual "did they pay" state is set by stripe-webhook,
// never trusted from the client-side redirect alone.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';

const LISTING_FEE_PENCE = 900; // £9 flat per listing, same as the single-listing flow

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

    const { bundleId, successUrl, cancelUrl } = await req.json();
    if (!bundleId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'Missing bundleId, successUrl or cancelUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: bundle, error: bundleError } = await supabase
      .from('listing_bundles')
      .select('id, seller_id, title, status, stripe_checkout_session_id')
      .eq('id', bundleId)
      .single();

    if (bundleError || !bundle) {
      return new Response(JSON.stringify({ error: 'Fleet bundle not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (bundle.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not your fleet bundle' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (bundle.status !== 'draft') {
      return new Response(JSON.stringify({ error: 'This fleet bundle is not awaiting payment' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (bundle.stripe_checkout_session_id) {
      return new Response(JSON.stringify({ error: 'Checkout has already been started for this fleet' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id')
      .eq('bundle_id', bundleId)
      .eq('fee_status', 'pending');
    if (listingsError) throw listingsError;
    if (!listings || listings.length < 2) {
      return new Response(JSON.stringify({ error: 'This fleet needs at least 2 items awaiting payment' }), {
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
              name: 'Relay fleet listing fee',
              description: `${listings.length} listings — ${bundle.title}`,
            },
          },
          quantity: listings.length,
        },
      ],
      metadata: { bundle_id: bundleId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await supabase
      .from('listing_bundles')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', bundleId);

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
