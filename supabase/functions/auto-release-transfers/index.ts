// Scheduled (pg_cron, see the delayed_payout migration), never called by a
// client. Two passes each run: (1) email buyers on day 11 of the 14-day
// hold to warn them the seller is about to be paid, (2) actually release
// the transfer for anything that's now past day 14. Nothing here is
// gated on Confirm Receipt — this is exactly the path for a buyer who
// never responds.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/notify.ts';
import { releaseTransfer } from '../_shared/releaseTransfer.ts';

const REMINDER_DAYS = 11;
const RELEASE_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const now = Date.now();
  const reminderCutoff = new Date(now - REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const releaseCutoff = new Date(now - RELEASE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let reminded = 0;
  let released = 0;
  const errors: string[] = [];

  try {
    // --- Reminder pass ---
    const { data: dueForReminder, error: reminderFetchError } = await supabase
      .from('orders')
      .select('id, buyer_id, transfer_status, dispute_status, order_deliveries!inner(shipped_at, release_reminder_sent_at)')
      .eq('status', 'paid')
      .eq('transfer_status', 'pending')
      .is('dispute_status', null)
      .lte('order_deliveries.shipped_at', reminderCutoff)
      .is('order_deliveries.release_reminder_sent_at', null);
    if (reminderFetchError) {
      console.error('Failed to fetch orders due for reminder', reminderFetchError);
    } else {
      for (const order of dueForReminder ?? []) {
        const { data: pendingRefund } = await supabase
          .from('refund_requests')
          .select('id')
          .eq('order_id', order.id)
          .eq('status', 'pending')
          .maybeSingle();
        if (pendingRefund) continue;

        await notifyUser(
          supabase,
          order.buyer_id,
          'Your order will be marked received soon',
          `<p>It's been ${REMINDER_DAYS} days since this order shipped. Unless you confirm receipt or raise an issue, ` +
            `it'll automatically be marked received and the seller paid in about ${RELEASE_DAYS - REMINDER_DAYS} days.</p>`,
        );
        await supabase
          .from('order_deliveries')
          .update({ release_reminder_sent_at: new Date().toISOString() })
          .eq('order_id', order.id);
        reminded += 1;
      }
    }

    // --- Release pass ---
    const { data: dueForRelease, error: releaseFetchError } = await supabase
      .from('orders')
      .select(
        'id, seller_id, amount, currency, platform_fee_amount, transfer_status, stripe_payment_intent_id, dispute_status, order_deliveries!inner(shipped_at)',
      )
      .eq('status', 'paid')
      .eq('transfer_status', 'pending')
      .is('dispute_status', null)
      .lte('order_deliveries.shipped_at', releaseCutoff);
    if (releaseFetchError) {
      console.error('Failed to fetch orders due for release', releaseFetchError);
    } else {
      for (const order of dueForRelease ?? []) {
        const { data: pendingRefund } = await supabase
          .from('refund_requests')
          .select('id')
          .eq('order_id', order.id)
          .eq('status', 'pending')
          .maybeSingle();
        if (pendingRefund) continue;

        const result = await releaseTransfer(supabase, stripe, order, 'auto_release');
        if (result.ok) released += 1;
        else errors.push(`${order.id}: ${result.error}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, reminded, released, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('auto-release-transfers failed', err);
    return new Response(JSON.stringify({ error: 'Something went wrong running auto-release.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
