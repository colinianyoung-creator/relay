// Respond to the proposal on the table with a different amount — flips
// whose turn it is, same "not your own proposal" rule as accept/decline.
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

    const { offerId, amount } = await req.json();
    if (!offerId || !amount) {
      return new Response(JSON.stringify({ error: 'Missing offerId or amount' }), {
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

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id, buyer_id, seller_id, proposed_by, status, listing:listings(title)')
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
        JSON.stringify({ error: "You can't counter your own proposal — waiting on the other side." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: updateError } = await supabase
      .from('offers')
      .update({ amount, proposed_by: callerSide, updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (updateError) throw updateError;

    const otherId = user.id === offer.buyer_id ? offer.seller_id : offer.buyer_id;
    const listingTitle = offer.listing?.title ?? 'a listing';
    await notifyUser(
      supabase,
      otherId,
      `New counter-offer on ${listingTitle}`,
      `<p>You've received a counter-offer on "${listingTitle}" — check your Offers tab to respond.</p>`,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong sending the counter-offer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
