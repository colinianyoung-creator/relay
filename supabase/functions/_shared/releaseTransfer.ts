// Moves a paid order's seller share out of Relay's platform balance into
// the seller's Connect account — the actual "payout" step under separate
// charges & transfers. Called from confirm-receipt (buyer clicked Confirm
// Receipt), confirm-handover (QR-scanned collection handoff), and
// auto-release-transfers (14-day no-response fallback, or 48h after a
// self-reported courier delivery). Never assumes the caller already checked
// eligibility — re-checks transfer_status, disputes and pending refund
// requests itself so it's safe to call from any of those paths.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { notifyUser } from './notify.ts';

export type ReleasedBy = 'buyer_confirmed' | 'auto_release' | 'admin' | 'delivery_timeout';

interface OrderForRelease {
  id: string;
  seller_id: string;
  amount: number;
  currency: string;
  platform_fee_amount: number;
  transfer_status: string;
  stripe_payment_intent_id: string | null;
  dispute_status: string | null;
}

export async function releaseTransfer(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  order: OrderForRelease,
  releasedBy: ReleasedBy,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (order.transfer_status !== 'pending') {
    return { ok: false, error: 'This order is not awaiting a transfer.' };
  }
  if (order.dispute_status) {
    return { ok: false, error: 'This order has an open dispute — funds are held pending resolution.' };
  }
  if (!order.stripe_payment_intent_id) {
    return { ok: false, error: 'This order has no payment on file.' };
  }

  const { data: pendingRefund } = await supabase
    .from('refund_requests')
    .select('id')
    .eq('order_id', order.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingRefund) {
    return { ok: false, error: 'This order has a pending refund request — resolve that first.' };
  }

  const { data: seller } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', order.seller_id)
    .single();
  if (!seller?.stripe_connect_account_id) {
    return { ok: false, error: "The seller's Connect account could not be found." };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    const chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id;
    if (!chargeId) {
      return { ok: false, error: 'No charge found for this payment.' };
    }

    const sellerAmountMinor = Math.round((Number(order.amount) - Number(order.platform_fee_amount)) * 100);

    const transfer = await stripe.transfers.create({
      amount: sellerAmountMinor,
      currency: order.currency.toLowerCase(),
      destination: seller.stripe_connect_account_id,
      source_transaction: chargeId,
    });

    await supabase
      .from('orders')
      .update({
        transfer_status: 'released',
        stripe_transfer_id: transfer.id,
        transfer_released_at: new Date().toISOString(),
        transfer_released_by: releasedBy,
      })
      .eq('id', order.id);

    await notifyUser(
      supabase,
      order.seller_id,
      'Funds released for your sale',
      '<p>Your buyer has confirmed receipt (or the hold period has passed) — your payout for this sale has now been sent to your connected account.</p>',
    );

    return { ok: true };
  } catch (err) {
    console.error('releaseTransfer failed for order', order.id, err);
    return { ok: false, error: err instanceof Error ? err.message : 'Stripe transfer failed' };
  }
}
