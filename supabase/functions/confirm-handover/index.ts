// Buyer-only: redeems a handover token scanned from the seller's QR code at
// local collection, releasing the held transfer immediately — the
// collection equivalent of confirm-receipt, just triggered by a scan
// instead of a plain button tap. The token is single-use: it's cleared as
// soon as it's redeemed, so a second submission (or someone else who saw
// the code) can't replay it.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';
import { releaseTransfer } from '../_shared/releaseTransfer.ts';

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

    const { orderId, token } = await req.json();
    if (!orderId || !token) {
      return new Response(JSON.stringify({ error: 'Missing orderId or token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, buyer_id, seller_id, status, amount, currency, platform_fee_amount, transfer_status, stripe_payment_intent_id, dispute_status',
      )
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
    if (order.status !== 'paid' || order.transfer_status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This order has already been settled.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from('order_deliveries')
      .select('handover_token, handover_token_expires_at')
      .eq('order_id', orderId)
      .maybeSingle();
    if (deliveryError || !delivery?.handover_token || delivery.handover_token !== token) {
      return new Response(JSON.stringify({ error: 'This code is invalid — ask the seller to generate a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!delivery.handover_token_expires_at || new Date(delivery.handover_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This code has expired — ask the seller to generate a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const result = await releaseTransfer(supabase, stripe, order, 'buyer_confirmed');
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('order_deliveries')
      .update({
        received_confirmed_at: new Date().toISOString(),
        handover_token: null,
        handover_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong confirming handover.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
