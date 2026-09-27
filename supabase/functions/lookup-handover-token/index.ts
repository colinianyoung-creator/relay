// Resolves a scanned/opened handover QR (see generate-handover-code) into
// display state for whoever opened it — the buyer (who can confirm receipt
// from here), the seller (read-only status), or, if it's neither of them,
// a rejection. This is what makes the QR a real link: printed on the parcel
// or shown on screen, it now opens /scan/:token in the browser, which calls
// this function rather than requiring the in-app photo-scan flow.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: delivery } = await supabase
      .from('order_deliveries')
      .select('order_id, handover_token_expires_at, received_confirmed_at, shipped_at, method')
      .eq('handover_token', token)
      .maybeSingle();

    // Not a delivery token — try a return token before giving up. Both live
    // in separate tables (order_deliveries / order_returns) since they're
    // opposite legs with different fields, but share one opaque token space
    // by construction (crypto.randomUUID x2), so a plain lookup-by-token
    // across both is safe.
    const { data: ret } = delivery
      ? { data: null }
      : await supabase
          .from('order_returns')
          .select('order_id, handover_token_expires_at, shipped_at, received_at, return_address, return_recipient_name')
          .eq('handover_token', token)
          .maybeSingle();

    if (!delivery && !ret) {
      return new Response(JSON.stringify({ error: 'This code is invalid — ask them to generate a new one.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderId = delivery?.order_id ?? ret!.order_id;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, buyer_id, seller_id, transfer_status, listing:listings(title), bundle:listing_bundles(title)',
      )
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let role: 'buyer' | 'seller';
    if (order.buyer_id === user.id) role = 'buyer';
    else if (order.seller_id === user.id) role = 'seller';
    else {
      return new Response(JSON.stringify({ error: "This code isn't for you." }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const title =
      (order.listing as { title?: string } | null)?.title ??
      (order.bundle as { title?: string } | null)?.title ??
      'this item';

    if (ret) {
      const returnExpired = !ret.handover_token_expires_at || new Date(ret.handover_token_expires_at) < new Date();
      return new Response(
        JSON.stringify({
          kind: 'return',
          role,
          orderId: order.id,
          title,
          shippedAt: ret.shipped_at,
          receivedAt: ret.received_at,
          returnAddress: ret.return_address,
          returnRecipientName: ret.return_recipient_name,
          expired: returnExpired && !ret.received_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const expired = !delivery!.handover_token_expires_at || new Date(delivery!.handover_token_expires_at) < new Date();
    return new Response(
      JSON.stringify({
        kind: 'delivery',
        role,
        orderId: order.id,
        title,
        settled: order.transfer_status !== 'pending',
        receivedConfirmedAt: delivery!.received_confirmed_at,
        shippedAt: delivery!.shipped_at,
        method: delivery!.method,
        expired: expired && order.transfer_status === 'pending',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong looking up this code.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
