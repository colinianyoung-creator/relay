// Shared refund logic for respond-refund-request (seller-approved) and
// admin-refund-order (admin-issued). Branches on transfer_status: if the
// seller's transfer hasn't fired yet, the charge is still sitting in
// Relay's own platform balance, so a plain refund can't fail on the seller's
// balance. If the transfer already released (buyer confirmed receipt, or it
// auto-released, before this refund), the money has left Relay's balance.
// Payouts are separate charges and transfers (see releaseTransfer.ts), so
// the charge has no attached transfer and refunds.create's reverse_transfer
// can never work here — the seller's transfer has to be reversed explicitly
// first, then the charge refunded. The reversal comes first so that if the
// seller has already paid the money out of their Connect balance (it fails),
// we stop before touching the buyer's money instead of refunding from
// Relay's own funds.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

interface OrderForRefund {
  id: string;
  status: string;
  transfer_status: string;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id?: string | null;
}

export async function refundOrder(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  order: OrderForRefund,
): Promise<{ ok: true; refundId: string } | { ok: false; error: string }> {
  if (order.status !== 'paid' || !order.stripe_payment_intent_id) {
    return { ok: false, error: 'This order is not in a refundable state.' };
  }

  try {
    if (order.transfer_status === 'released') {
      if (!order.stripe_transfer_id) {
        return { ok: false, error: "This order's payout transfer could not be found." };
      }
      // Skip if an earlier attempt already reversed it (reversal succeeded
      // but the refund itself then failed) — a second reversal would error.
      const transfer = await stripe.transfers.retrieve(order.stripe_transfer_id);
      if (transfer.amount_reversed < transfer.amount) {
        await stripe.transfers.createReversal(order.stripe_transfer_id);
      }
    }

    const refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });

    await supabase
      .from('orders')
      .update({ status: 'refunded', transfer_status: 'refunded' })
      .eq('id', order.id);

    return { ok: true, refundId: refund.id };
  } catch (err) {
    console.error('refundOrder failed for order', order.id, err);
    return { ok: false, error: err instanceof Error ? err.message : 'Stripe refund failed' };
  }
}
