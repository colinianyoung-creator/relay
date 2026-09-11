// Buyer's first step toward getting money back on a paid order — the seller
// has to approve it (see respond-refund-request) before anything actually
// moves, since these are Connect destination charges and an unconditional
// buyer-triggered refund risks pushing an already-paid-out seller's balance
// negative.
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

    const { orderId, reason, details } = await req.json();
    if (!orderId || !reason) {
      return new Response(JSON.stringify({ error: 'Missing orderId or reason' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, status, listing_id, bundle_listing_ids')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "This isn't your order" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'This order has not been paid yet' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: refundRequest, error: insertError } = await supabase
      .from('refund_requests')
      .insert({
        order_id: orderId,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        reason,
        details: details || null,
      })
      .select('id')
      .single();
    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ error: 'A refund has already been requested for this order.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error(insertError);
      return new Response(JSON.stringify({ error: 'Could not submit that refund request.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anchorListingId = order.listing_id ?? order.bundle_listing_ids?.[0];
    if (anchorListingId) {
      const { error: messageError } = await supabase.from('messages').insert({
        listing_id: anchorListingId,
        sender_id: user.id,
        recipient_id: order.seller_id,
        body: `I'd like to request a refund for this order — ${reason}.${details ? ` ${details}` : ''} You can approve or decline this from your Orders tab.`,
      });
      if (messageError) console.error('Failed to send refund-request message', messageError);
      await notifyUser(
        supabase,
        order.seller_id,
        'Refund requested',
        `<p>A refund has been requested for one of your orders — ${reason}. Check your Orders tab to approve or decline it.</p>`,
      );
    }

    return new Response(JSON.stringify({ id: refundRequest.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong requesting a refund.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
