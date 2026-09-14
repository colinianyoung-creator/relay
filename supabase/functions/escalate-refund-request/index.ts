// Buyer-only: escalates a declined refund request to Relay directly, since
// a decline used to be a dead end — no formal second attempt, no admin
// visibility, just messaging the seller. This is that second step.
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

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Missing requestId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: request, error: requestError } = await supabase
      .from('refund_requests')
      .select('id, order_id, buyer_id, seller_id, status, reason')
      .eq('id', requestId)
      .single();
    if (requestError || !request) {
      return new Response(JSON.stringify({ error: 'Refund request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "This isn't your refund request" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.status !== 'declined') {
      return new Response(JSON.stringify({ error: 'Only a declined refund request can be escalated' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('refund_requests')
      .update({ status: 'escalated', escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (updateError) {
      console.error(updateError);
      return new Response(JSON.stringify({ error: 'Could not escalate that request.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    for (const admin of admins ?? []) {
      await notifyUser(
        supabase,
        admin.id,
        'Refund request escalated',
        `<p>A buyer has escalated a declined refund request — ${request.reason}. Check Admin &gt; Orders to review it.</p>`,
      );
    }

    await notifyUser(
      supabase,
      request.seller_id,
      'A refund request was escalated to Relay',
      "<p>The buyer has asked Relay to review a refund request you declined on one of your orders. Relay's team will follow up if needed.</p>",
    );

    return new Response(JSON.stringify({ status: 'escalated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong escalating that request.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
