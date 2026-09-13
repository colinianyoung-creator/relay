// Shared refund logic for respond-refund-request (seller-approved) and
// admin-refund-order (admin-issued). Branches on transfer_status: if the
// seller's transfer hasn't fired yet, the charge is still sitting in
// Relay's own platform balance, so a plain refund needs no reverse_transfer
// and can't fail on the seller's balance. If the transfer already released
// (buyer confirmed receipt, or it auto-released, before this refund), the
// money really has left Relay's balance, so reverse_transfer pulls it back
// out of the seller's Connect balance same as the old destination-charge
// model — and that can still fail if they've already been paid out.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

interface OrderForRefund {
  id: string;
  status: string;
  transfer_status: string;
  stripe_payment_intent_id: string | null;
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
    const refund = await stripe.refunds.create(
      order.transfer_status === 'released'
        ? { payment_intent: order.stripe_payment_intent_id, reverse_transfer: true }
        : { payment_intent: order.stripe_payment_intent_id },
    );

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
