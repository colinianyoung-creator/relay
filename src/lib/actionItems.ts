import {
  fetchAdminActionCounts,
  fetchMyOffers,
  fetchMyOrders,
  fetchUnreadMessageCount,
  type AdminActionCounts,
  type MyOrder,
  type Offer,
} from '@/lib/supabaseData';
import { formatPrice } from '@/lib/format';

// "Action required" is derived from the live state of the user's orders,
// offers and messages rather than stored as notification rows: an item is
// there exactly while something is waiting on them, and disappears the moment
// they (or anyone else) resolve it, so it can never go stale or need
// dismissing. The trade-off is no history of past notifications.

export type ActionTab = 'Offers' | 'Orders' | 'Payouts' | 'Messages';

export interface ActionItem {
  /** Stable across refreshes — used as the React key. */
  id: string;
  title: string;
  detail: string;
  /** Where this lives inside the Account page. */
  target?: { tab: ActionTab; role?: 'buyer' | 'seller'; itemId?: string };
  /** An internal route outside Account (admin pages). */
  to?: string;
  /** How many things this item stands for (e.g. unread messages). Defaults to 1. */
  count?: number;
}

// How long a buyer is nudged about a declined refund — it's an option rather
// than a deadline, so it shouldn't nag forever.
const DECLINED_REFUND_NUDGE_DAYS = 30;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Sellers' in-flight sales live in Orders until paid out, then in Payouts. */
const sellerTab = (o: MyOrder): ActionTab => (o.transferStatus === 'released' ? 'Payouts' : 'Orders');

export function deriveActionItems(input: {
  orders: MyOrder[];
  offers: Offer[];
  unreadMessages: number;
  admin?: AdminActionCounts | null;
  now?: number;
}): ActionItem[] {
  const now = input.now ?? Date.now();
  const items: ActionItem[] = [];

  for (const o of input.orders) {
    const who = o.counterpartyName.split(' ')[0];

    if (o.role === 'seller' && o.status === 'paid' && o.refundStatus === 'pending') {
      const waitingOnBuyer = o.returnRequested && !o.returnShippedAt;
      if (waitingOnBuyer) continue;
      if (o.returnRequested && o.returnShippedAt && !o.returnReceivedAt) {
        items.push({
          id: `return-arrived:${o.id}`,
          title: 'Confirm the return has arrived',
          detail: `${who} sent back ${o.title}`,
          target: { tab: sellerTab(o), role: 'seller', itemId: o.id },
        });
      } else {
        items.push({
          id: `refund-request:${o.id}`,
          title: 'Respond to a refund request',
          detail: `${who} is asking for a refund on ${o.title}`,
          target: { tab: sellerTab(o), role: 'seller', itemId: o.id },
        });
      }
      continue;
    }

    if (
      o.role === 'seller' &&
      o.status === 'paid' &&
      o.transferStatus === 'pending' &&
      (o.deliveryMethod === 'courier' || o.deliveryMethod === 'freight') &&
      !o.shippedAt
    ) {
      items.push({
        id: `ship:${o.id}`,
        title: 'Ship this order',
        detail: `${who} has paid for ${o.title} — mark it as shipped once it's on its way`,
        target: { tab: 'Orders', role: 'seller', itemId: o.id },
      });
    }

    if (o.role === 'buyer') {
      if (o.status === 'pending' && o.fromOfferOrInvoice) {
        items.push({
          id: `pay:${o.id}`,
          title: 'Complete your payment',
          detail: `${o.title} from ${who} — ${formatPrice(o.amount, o.currency)}`,
          target: { tab: 'Offers', role: 'buyer', itemId: o.id },
        });
        continue;
      }
      if (o.status !== 'paid') continue;

      if (o.refundStatus === 'pending' && o.returnRequested && !o.returnShippedAt) {
        items.push({
          id: `send-back:${o.id}`,
          title: 'Send the item back',
          detail: `${who} has asked for ${o.title} to be returned before your refund`,
          target: { tab: 'Orders', role: 'buyer', itemId: o.id },
        });
      } else if (
        o.refundStatus === 'declined' &&
        o.refundRequestedAt &&
        now - new Date(o.refundRequestedAt).getTime() < DECLINED_REFUND_NUDGE_DAYS * 86_400_000
      ) {
        items.push({
          id: `declined:${o.id}`,
          title: 'Your refund request was declined',
          detail: `${who} declined it for ${o.title} — you can escalate it to Relay`,
          target: { tab: 'Orders', role: 'buyer', itemId: o.id },
        });
      } else if (
        o.transferStatus === 'pending' &&
        o.trackingStatus === 'delivered' &&
        !o.receivedConfirmedAt &&
        o.refundStatus !== 'pending'
      ) {
        items.push({
          id: `confirm:${o.id}`,
          title: 'Confirm you received it',
          detail: `${o.title} was marked delivered — payment is released automatically unless you raise an issue`,
          target: { tab: 'Orders', role: 'buyer', itemId: o.id },
        });
      }
    }
  }

  for (const offer of input.offers) {
    if (offer.status !== 'pending' || offer.proposedBy === offer.role) continue;
    const who = offer.counterpartyName.split(' ')[0];
    items.push({
      id: `offer:${offer.id}`,
      title: offer.role === 'seller' ? 'Respond to an offer' : 'Respond to a counter-offer',
      detail: `${who} offered ${formatPrice(offer.amount, offer.currency)} on ${offer.listingTitle}`,
      target: { tab: 'Offers', role: offer.role, itemId: offer.id },
    });
  }

  if (input.unreadMessages > 0) {
    items.push({
      id: 'unread-messages',
      title: plural(input.unreadMessages, 'unread message'),
      detail: 'Buyers and sellers are waiting to hear back',
      target: { tab: 'Messages' },
      count: input.unreadMessages,
    });
  }

  const admin = input.admin;
  if (admin) {
    if (admin.openReports > 0) {
      items.push({
        id: 'admin-reports',
        title: plural(admin.openReports, 'open report'),
        detail: 'Listings reported by members',
        to: '/admin/reports',
        count: admin.openReports,
      });
    }
    if (admin.escalatedRefunds > 0) {
      items.push({
        id: 'admin-escalated',
        title: plural(admin.escalatedRefunds, 'escalated refund'),
        detail: 'Declined by the seller — the buyer wants Relay to review',
        to: '/admin/orders',
        count: admin.escalatedRefunds,
      });
    }
    if (admin.failedRefunds > 0) {
      items.push({
        id: 'admin-failed',
        title: plural(admin.failedRefunds, 'failed refund'),
        detail: 'Approved but could not be processed — handle manually',
        to: '/admin/orders',
        count: admin.failedRefunds,
      });
    }
  }

  return items;
}

export async function fetchActionItems(userId: string, isAdmin: boolean): Promise<ActionItem[]> {
  const [orders, offers, unreadMessages, admin] = await Promise.all([
    fetchMyOrders(userId),
    fetchMyOffers(userId),
    fetchUnreadMessageCount(userId),
    isAdmin ? fetchAdminActionCounts() : Promise.resolve(null),
  ]);
  return deriveActionItems({ orders, offers, unreadMessages, admin });
}

export function countActionItems(items: ActionItem[]): number {
  return items.reduce((sum, item) => sum + (item.count ?? 1), 0);
}

/** Per-tab totals for the Account tab badges. */
export function actionCountsByTab(items: ActionItem[]): Partial<Record<ActionTab, number>> {
  const totals: Partial<Record<ActionTab, number>> = {};
  for (const item of items) {
    if (!item.target) continue;
    totals[item.target.tab] = (totals[item.target.tab] ?? 0) + (item.count ?? 1);
  }
  return totals;
}
