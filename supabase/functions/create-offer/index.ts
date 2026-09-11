// Buyer proposes a price on a listing. No payment happens here — this just
// opens (or re-opens) a negotiation; see accept-offer for what happens once
// a price is actually agreed.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/notify.ts';

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

    const { listingId, amount, currency, message } = await req.json();
    if (!listingId || !amount || !currency) {
      return new Response(JSON.stringify({ error: 'Missing listingId, amount or currency' }), {
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

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, seller_id, sold_at, fee_status, price')
      .eq('id', listingId)
      .single();
    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.seller_id === user.id) {
      return new Response(JSON.stringify({ error: "You can't make an offer on your own listing" }), {
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
    if (listing.fee_status !== 'paid') {
      return new Response(JSON.stringify({ error: "This listing hasn't finished publishing yet" }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.price === null) {
      return new Response(JSON.stringify({ error: "This listing doesn't have a price to offer against" }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount,
        currency,
        message: message || null,
        proposed_by: 'buyer',
        status: 'pending',
      })
      .select('id')
      .single();
    if (offerError) {
      // Unique index catches the race — a buyer already has an open offer here.
      if (offerError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'You already have an open offer on this listing.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      console.error(offerError);
      return new Response(JSON.stringify({ error: 'Could not send the offer.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await notifyUser(
      supabase,
      listing.seller_id,
      `New offer on ${listing.title}`,
      `<p>You've received a new offer on "${listing.title}" — check your Offers tab to respond.</p>`,
    );

    return new Response(JSON.stringify({ id: offer.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong sending the offer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
