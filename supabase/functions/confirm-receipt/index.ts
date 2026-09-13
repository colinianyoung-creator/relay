// Buyer-only: marks an order received and releases the held transfer to the
// seller straight away, rather than waiting for the 14-day auto-release
// (see auto-release-transfers). This is the main way funds move under the
// separate-charges-and-transfers model.
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

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
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
    if (order.status !== 'paid') {
      return new Response(JSON.stringify({ error: 'This order has not been paid.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.transfer_status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This order has already been settled.' }), {
        status: 409,
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
      .upsert(
        { order_id: orderId, received_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'order_id' },
      );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong confirming receipt.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
