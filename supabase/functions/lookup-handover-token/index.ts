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

    const { data: delivery, error: deliveryError } = await supabase
      .from('order_deliveries')
      .select('order_id, handover_token_expires_at, received_confirmed_at, shipped_at, method')
      .eq('handover_token', token)
      .maybeSingle();
    if (deliveryError || !delivery) {
      return new Response(JSON.stringify({ error: 'This code is invalid — ask the seller to generate a new one.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, buyer_id, seller_id, transfer_status, listing:listings(title), bundle:listing_bundles(title)',
      )
      .eq('id', delivery.order_id)
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

    const expired = !delivery.handover_token_expires_at || new Date(delivery.handover_token_expires_at) < new Date();
    const title =
      (order.listing as { title?: string } | null)?.title ??
      (order.bundle as { title?: string } | null)?.title ??
      'this item';

    return new Response(
      JSON.stringify({
        role,
        orderId: order.id,
        title,
        settled: order.transfer_status !== 'pending',
        receivedConfirmedAt: delivery.received_confirmed_at,
        shippedAt: delivery.shipped_at,
        method: delivery.method,
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
