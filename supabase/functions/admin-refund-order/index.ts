// Admin-only: refunds any paid order directly, without waiting for a buyer
// to file a refund request first — the case this exists for is a seller who
// never ships, where the buyer may not think to (or know how to) ask. Also
// doubles as how admin approves an escalated refund request (see
// escalate-refund-request/dismiss-refund-escalation) — this is the "yes"
// path, dismiss-refund-escalation is the "no" path.
// Uses the same refundOrder branching as respond-refund-request, and
// records itself in refund_requests (initiated_by: 'admin') so every
// refund, however it started, shows up in the same audit trail.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/notify.ts';
import { refundOrder } from '../_shared/refundOrder.ts';

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

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId, reason } = await req.json();
    if (!orderId || !reason) {
      return new Response(JSON.stringify({ error: 'Missing orderId or reason' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, status, transfer_status, stripe_payment_intent_id')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existingRequest } = await supabase
      .from('refund_requests')
      .select('id, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (existingRequest && existingRequest.status !== 'failed' && existingRequest.status !== 'escalated') {
      return new Response(
        JSON.stringify({ error: 'This order already has a refund request in progress or resolved.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const result = await refundOrder(stripe, supabase, order);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const refundRow = {
      order_id: orderId,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      reason,
      status: 'refunded' as const,
      initiated_by: 'admin' as const,
      stripe_refund_id: result.refundId,
      updated_at: new Date().toISOString(),
    };
    if (existingRequest) {
      await supabase.from('refund_requests').update(refundRow).eq('id', existingRequest.id);
    } else {
      await supabase.from('refund_requests').insert(refundRow);
    }

    await notifyUser(
      supabase,
      order.buyer_id,
      'Refund issued',
      `<p>Relay has issued a refund for this order — ${reason}.</p>`,
    );
    await notifyUser(
      supabase,
      order.seller_id,
      'A refund was issued on one of your orders',
      `<p>Relay has refunded a buyer for one of your orders — ${reason}.</p>`,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong issuing that refund.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
