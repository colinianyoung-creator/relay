// Seller-only: turns a pending refund request into "return it to me first" —
// records the address the buyer should send it back to and generates a
// handover token, the same shape as generate-handover-code but for the
// reverse leg. Doesn't touch Stripe or the refund_requests row at all;
// Approve refund (respond-refund-request) stays a manual, independent
// action the seller can still take at any time regardless of return status.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/notify.ts';

// A printed/shown code for a physical return needs to span a realistic
// posting window — same TTL as the courier/freight outbound handover code.
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

    const { orderId, returnAddress, returnRecipientName } = await req.json();
    if (!orderId || !returnAddress?.line1 || !returnAddress?.postal_code || !returnAddress?.country || !returnRecipientName) {
      return new Response(JSON.stringify({ error: 'Missing orderId or a complete return address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, listing_id, bundle_listing_ids')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: "This isn't your order" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: refund, error: refundError } = await supabase
      .from('refund_requests')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (refundError || !refund || refund.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'There is no pending refund request on this order.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error: upsertError } = await supabase.from('order_returns').upsert(
      {
        order_id: orderId,
        return_address: returnAddress,
        return_recipient_name: returnRecipientName,
        handover_token: token,
        handover_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    );
    if (upsertError) {
      console.error(upsertError);
      return new Response(JSON.stringify({ error: 'Could not set up the return.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anchorListingId = order.listing_id ?? order.bundle_listing_ids?.[0];
    if (anchorListingId) {
      await supabase.from('messages').insert({
        listing_id: anchorListingId,
        sender_id: user.id,
        recipient_id: order.buyer_id,
        body: "I'd like this returned before refunding — check your Orders tab for the return address and a code to send it back with.",
      });
    }
    await notifyUser(
      supabase,
      order.buyer_id,
      'The seller has asked for this item back',
      '<p>Before refunding, the seller has asked for this item to be sent back to them. Check your Orders tab for the return address and a code to mark it sent when you post it.</p>',
    );

    return new Response(JSON.stringify({ token, expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong setting up the return.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
