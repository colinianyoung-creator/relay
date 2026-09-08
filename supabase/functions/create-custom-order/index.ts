// Seller-initiated invoice: pick some of your own unsold listings, name a
// negotiated total, and send it to a buyer you've already been talking to.
// No Stripe session is created here — that happens lazily when the buyer
// actually clicks "Pay now" (see pay-custom-order), so an invoice sitting
// unpaid for a few days while a deal gets finalised never goes stale.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Kept identical to create-purchase-checkout's constant, just computed
// early here (before any Stripe session exists) so the invoice can show
// both parties what Relay's cut will be up front.
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

    const { buyerId, listingIds, amount, currency, bundleId } = await req.json();
    if (!buyerId || !Array.isArray(listingIds) || listingIds.length === 0 || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing buyerId, listingIds, amount or currency' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (buyerId === user.id) {
      return new Response(JSON.stringify({ error: "You can't invoice yourself" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (Number(amount) <= 0) {
      return new Response(JSON.stringify({ error: 'Amount must be greater than zero' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: buyerProfile, error: buyerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', buyerId)
      .single();
    if (buyerError || !buyerProfile) {
      return new Response(JSON.stringify({ error: 'Buyer account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, seller_id, sold_at, fee_status')
      .in('id', listingIds);
    if (listingsError || !listings || listings.length !== listingIds.length) {
      return new Response(JSON.stringify({ error: 'One or more listings could not be found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listings.some((l) => l.seller_id !== user.id)) {
      return new Response(JSON.stringify({ error: "You can only invoice for your own listings" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listings.some((l) => l.sold_at)) {
      return new Response(JSON.stringify({ error: 'One or more of these listings has already sold' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listings.some((l) => l.fee_status === 'pending')) {
      return new Response(
        JSON.stringify({ error: "One or more of these listings hasn't finished publishing yet" }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const platformFeeAmount = Math.round(Number(amount) * PLATFORM_FEE_PERCENT) / 100;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        seller_id: user.id,
        bundle_listing_ids: listingIds,
        bundle_id: bundleId ?? null,
        amount,
        currency,
        platform_fee_amount: platformFeeAmount,
        status: 'pending',
      })
      .select('id')
      .single();
    if (orderError || !order) {
      console.error(orderError);
      return new Response(JSON.stringify({ error: 'Could not create the invoice.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong creating the invoice.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
