// Seller-only: generates an opaque token for an order, which the frontend
// renders as a QR code for the buyer to scan (see confirm-handover) — shown
// on screen at in-person collection, or printed and attached to the parcel
// for courier/freight. Regenerating overwrites — and so invalidates — any
// previous token for this order.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Collection is scanned in the same moment it's shown, so a short window is
// fine. A courier/freight code is printed onto the parcel and may not be
// scanned for days, so it needs to span a realistic delivery window.
const TOKEN_TTL_MS: Record<string, number> = {
  collection: 15 * 60 * 1000,
  courier: 30 * 24 * 60 * 60 * 1000,
  freight: 30 * 24 * 60 * 60 * 1000,
};

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
      .select('id, seller_id, status, transfer_status')
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
    if (order.status !== 'paid' || order.transfer_status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This order is not awaiting handover.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: delivery } = await supabase
      .from('order_deliveries')
      .select('method')
      .eq('order_id', orderId)
      .maybeSingle();
    const method = delivery?.method ?? 'courier';

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + (TOKEN_TTL_MS[method] ?? TOKEN_TTL_MS.courier)).toISOString();

    const { error: upsertError } = await supabase.from('order_deliveries').upsert(
      {
        order_id: orderId,
        method,
        handover_token: token,
        handover_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    );
    if (upsertError) {
      console.error(upsertError);
      return new Response(JSON.stringify({ error: 'Could not generate a handover code.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ token, expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong generating a handover code.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
