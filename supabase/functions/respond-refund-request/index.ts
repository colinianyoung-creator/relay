// Seller approves or declines a pending refund request. Approval is what
// actually calls Stripe — this is a Connect destination charge, so
// reverse_transfer pulls the money back out of the seller's own Connect
// balance; if that balance can't cover it (already paid out), the refund
// fails here and the request is marked 'failed' for admin to handle
// manually rather than the app pretending it succeeded.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
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

    const { requestId, decision, note } = await req.json();
    if (!requestId || (decision !== 'approve' && decision !== 'decline')) {
      return new Response(JSON.stringify({ error: 'Missing requestId or invalid decision' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: request, error: requestError } = await supabase
      .from('refund_requests')
      .select('id, order_id, buyer_id, seller_id, status')
      .eq('id', requestId)
      .single();
    if (requestError || !request) {
      return new Response(JSON.stringify({ error: 'Refund request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: "This isn't your refund request to respond to" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This request has already been responded to' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, status, listing_id, bundle_listing_ids, stripe_payment_intent_id')
      .eq('id', request.order_id)
      .single();
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'The order for this request could not be found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anchorListingId = order.listing_id ?? order.bundle_listing_ids?.[0];

    if (decision === 'decline') {
      const { error: updateError } = await supabase
        .from('refund_requests')
        .update({ status: 'declined', seller_response: note || null, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updateError) {
        console.error(updateError);
        return new Response(JSON.stringify({ error: 'Could not decline that request.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (anchorListingId) {
        await supabase.from('messages').insert({
          listing_id: anchorListingId,
          sender_id: user.id,
          recipient_id: order.buyer_id,
          body: `I've declined the refund request for this order.${note ? ` ${note}` : ''}`,
        });
      }
      await notifyUser(
        supabase,
        order.buyer_id,
        'Refund request declined',
        `<p>Your refund request was declined.${note ? ` ${note}` : ''}</p>`,
      );
      return new Response(JSON.stringify({ status: 'declined' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Approve — this is the only path that actually moves money.
    if (order.status !== 'paid' || !order.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: 'This order is not in a refundable state.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        reverse_transfer: true,
        refund_application_fee: true,
      });

      await supabase
        .from('refund_requests')
        .update({
          status: 'refunded',
          seller_response: note || null,
          stripe_refund_id: refund.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      await supabase.from('orders').update({ status: 'refunded' }).eq('id', order.id);

      if (anchorListingId) {
        await supabase.from('messages').insert({
          listing_id: anchorListingId,
          sender_id: user.id,
          recipient_id: order.buyer_id,
          body: `I've approved the refund for this order — it's on its way back to you.${note ? ` ${note}` : ''}`,
        });
      }
      await notifyUser(
        supabase,
        order.buyer_id,
        'Refund approved',
        `<p>Your refund was approved — it's on its way back to you.${note ? ` ${note}` : ''}</p>`,
      );

      return new Response(JSON.stringify({ status: 'refunded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (stripeErr) {
      console.error('Stripe refund failed', stripeErr);
      const failureReason = stripeErr instanceof Error ? stripeErr.message : 'Stripe refund failed';
      await supabase
        .from('refund_requests')
        .update({ status: 'failed', failure_reason: failureReason, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (anchorListingId) {
        await supabase.from('messages').insert({
          listing_id: anchorListingId,
          sender_id: user.id,
          recipient_id: order.buyer_id,
          body: "I've approved this refund, but the payment couldn't be automatically reversed — Relay's team will follow up to sort it out manually.",
        });
      }
      await notifyUser(
        supabase,
        order.buyer_id,
        'Refund approved — follow-up needed',
        "<p>Your refund was approved but couldn't be processed automatically. Relay's team will follow up to sort it out manually.</p>",
      );

      return new Response(
        JSON.stringify({ error: "The refund couldn't be processed automatically — it's been flagged for manual review." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong responding to the refund request.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
