// Relay doesn't call a carrier API — this formalises the ask and nudges the
// other party toward getting a quote themselves (a standard courier for
// parcel-sized items, or a freight marketplace like uShip for oversized kit),
// then recording it back on the order via update-delivery-details.
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

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
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
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
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

    const { error: upsertError } = await supabase
      .from('order_deliveries')
      .upsert(
        {
          order_id: orderId,
          quote_requested_at: new Date().toISOString(),
          quote_requested_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' },
      );
    if (upsertError) {
      console.error(upsertError);
      return new Response(JSON.stringify({ error: 'Could not record the quote request.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
    const anchorListingId = order.listing_id ?? order.bundle_listing_ids?.[0];
    if (anchorListingId) {
      const { error: messageError } = await supabase.from('messages').insert({
        listing_id: anchorListingId,
        sender_id: user.id,
        recipient_id: recipientId,
        body:
          "I'd like to get a shipping quote sorted for this order. Relay doesn't book " +
          'carriers automatically yet — could you get a quote from a courier (for a boxed ' +
          'parcel) or a freight marketplace like uShip (for anything oversized), and we can ' +
          "record the method and tracking details on the order once it's arranged?",
      });
      if (messageError) console.error('Failed to send shipping-quote message', messageError);
      await notifyUser(
        supabase,
        recipientId,
        'Shipping quote requested',
        "<p>A shipping quote has been requested for one of your orders — check your Messages for details.</p>",
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong requesting a quote.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
