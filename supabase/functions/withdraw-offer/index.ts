// Pull back your own open proposal — the mirror of decline-offer, which is
// for the other party rejecting it instead.
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

    const { offerId } = await req.json();
    if (!offerId) {
      return new Response(JSON.stringify({ error: 'Missing offerId' }), {
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
    if (callerSide !== offer.proposed_by) {
      return new Response(
        JSON.stringify({ error: "This isn't your proposal to withdraw — you can decline it instead." }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: updateError } = await supabase
      .from('offers')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', offerId);
    if (updateError) throw updateError;

    const otherId = user.id === offer.buyer_id ? offer.seller_id : offer.buyer_id;
    const listingTitle = offer.listing?.title ?? 'a listing';
    await notifyUser(
      supabase,
      otherId,
      `An offer on ${listingTitle} was withdrawn`,
      `<p>The offer on "${listingTitle}" you were waiting on has been withdrawn.</p>`,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong withdrawing the offer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
