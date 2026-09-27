// Buyer-only: records that a requested return has been posted back to the
// seller. Callable two ways, same as the outbound leg's "mark as shipped" —
// a button inside the app (no token), or via /scan/:token after opening the
// handover QR/link printed on the parcel (token, checked if present). Purely
// informational: no Stripe/payout call here, Approve refund is still a
// separate, manual action.
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

    const { orderId, token, trackingReference } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
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
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "This isn't your order" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ret, error: retError } = await supabase
      .from('order_returns')
      .select('id, handover_token, handover_token_expires_at, shipped_at')
      .eq('order_id', orderId)
      .maybeSingle();
    if (retError || !ret) {
      return new Response(JSON.stringify({ error: 'No return has been requested for this order.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (token) {
      if (ret.handover_token !== token) {
        return new Response(JSON.stringify({ error: 'This code is invalid — check the link and try again.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!ret.handover_token_expires_at || new Date(ret.handover_token_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'This code has expired.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    await supabase
      .from('order_returns')
      .update({
        shipped_at: ret.shipped_at ?? new Date().toISOString(),
        tracking_reference: trackingReference ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    const anchorListingId = order.listing_id ?? order.bundle_listing_ids?.[0];
    if (anchorListingId) {
      await supabase.from('messages').insert({
        listing_id: anchorListingId,
        sender_id: user.id,
        recipient_id: order.seller_id,
        body: `I've sent this back to you.${trackingReference ? ` Tracking: ${trackingReference}` : ''}`,
      });
    }
    await notifyUser(
      supabase,
      order.seller_id,
      'A return is on its way to you',
      `<p>The buyer has marked this item as sent back to you.${trackingReference ? ` Tracking reference: ${trackingReference}.` : ''} Confirm receipt from your Orders tab once it arrives, then approve the refund.</p>`,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong marking this as sent.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
