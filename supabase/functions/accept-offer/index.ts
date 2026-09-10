// Turns an agreed offer into a payable invoice. Deliberately produces the
// exact same orders row shape create-custom-order does — bundle_listing_ids
// holding the one listing, bundle_id null — so pay-custom-order,
// stripe-webhook, and the Invoices tab handle it with no changes at all.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    const { offerId } = await req.json();
    if (!offerId) {
      return new Response(JSON.stringify({ error: 'Missing offerId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id, listing_id, buyer_id, seller_id, amount, currency, proposed_by, status')
      .eq('id', offerId)
      .single();
    if (offerError || !offer) {
      return new Response(JSON.stringify({ error: 'Offer not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (offer.buyer_id !== user.id && offer.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: "This isn't your offer" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (offer.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This offer is no longer open' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerSide = offer.buyer_id === user.id ? 'buyer' : 'seller';
    if (callerSide === offer.proposed_by) {
      return new Response(
        JSON.stringify({ error: "You can't accept your own proposal — waiting on the other side." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Re-validate — time may have passed since the offer was made.
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, seller_id, sold_at, fee_status')
      .eq('id', offer.listing_id)
      .single();
    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'The listing on this offer could not be found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.seller_id !== offer.seller_id) {
      return new Response(JSON.stringify({ error: 'This listing no longer belongs to the offer seller' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.sold_at) {
      return new Response(JSON.stringify({ error: 'This listing has already sold' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.fee_status !== 'paid') {
      return new Response(JSON.stringify({ error: "This listing isn't currently live" }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const platformFeeAmount = Math.round(Number(offer.amount) * PLATFORM_FEE_PERCENT) / 100;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        bundle_listing_ids: [offer.listing_id],
        bundle_id: null,
        amount: offer.amount,
        currency: offer.currency,
        platform_fee_amount: platformFeeAmount,
        status: 'pending',
      })
      .select('id')
      .single();
    if (orderError || !order) {
      console.error(orderError);
      return new Response(JSON.stringify({ error: 'Could not create the invoice for this offer.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('offers')
      .update({ status: 'accepted', order_id: order.id, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (updateError) console.error('Failed to mark offer accepted', updateError);

    return new Response(JSON.stringify({ orderId: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong accepting the offer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
