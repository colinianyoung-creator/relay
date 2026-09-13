// Lets either side of a paid order record whatever they actually arranged —
// method plus a manually-pasted tracking reference/link. No carrier API
// involved; see request-shipping-quote for the nudge that leads here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const METHODS = ['collection', 'courier', 'freight'];

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

    const {
      orderId,
      method,
      trackingReference,
      trackingUrl,
      notes,
      addEvidencePath,
      removeEvidencePath,
      markShipped,
      markDelivered,
    } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (method !== undefined && method !== null && !METHODS.includes(method)) {
      return new Response(JSON.stringify({ error: 'Invalid delivery method' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, status')
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
    if (markShipped && order.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the seller can mark an order as shipped' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (markDelivered && order.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the seller can mark an order as delivered' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await supabase
      .from('order_deliveries')
      .select('shipped_at, delivered_at, method, tracking_reference, evidence_paths')
      .eq('order_id', orderId)
      .maybeSingle();

    const update: Record<string, unknown> = { order_id: orderId, updated_at: new Date().toISOString() };
    if (method !== undefined) update.method = method;
    if (trackingReference !== undefined) update.tracking_reference = trackingReference;
    if (trackingUrl !== undefined) update.tracking_url = trackingUrl;
    if (notes !== undefined) update.notes = notes;

    if (markShipped) {
      if (!existing?.shipped_at) update.shipped_at = new Date().toISOString();
    }

    if (markDelivered) {
      const effectiveMethod = method !== undefined ? method : existing?.method;
      const effectiveTracking = trackingReference !== undefined ? trackingReference : existing?.tracking_reference;
      if (effectiveMethod !== 'courier' && effectiveMethod !== 'freight') {
        return new Response(
          JSON.stringify({ error: 'Marking delivered only applies to courier or freight orders.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (!effectiveTracking || effectiveTracking.trim().length < 4 || effectiveTracking.trim().length > 40) {
        return new Response(
          JSON.stringify({ error: 'Enter a valid tracking reference (4-40 characters) before marking delivered.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (!existing?.delivered_at) {
        update.tracking_status = 'delivered';
        update.delivered_at = new Date().toISOString();
      }
    }

    if (addEvidencePath || removeEvidencePath) {
      let paths = existing?.evidence_paths ?? [];
      if (addEvidencePath) paths = [...paths, addEvidencePath];
      if (removeEvidencePath) paths = paths.filter((p: string) => p !== removeEvidencePath);
      update.evidence_paths = paths;
    }

    const { error: upsertError } = await supabase
      .from('order_deliveries')
      .upsert(update, { onConflict: 'order_id' });
    if (upsertError) {
      console.error(upsertError);
      return new Response(JSON.stringify({ error: 'Could not save those delivery details.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong saving delivery details.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
