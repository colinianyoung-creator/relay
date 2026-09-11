import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  PackagePlus,
  Loader2,
  Camera,
  Boxes,
  CreditCard,
  X,
  Tag,
  Check,
  ChevronDown,
  ExternalLink,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  fetchListingsBySeller,
  fetchSavedListings,
  fetchMessageThreads,
  fetchMyOrders,
  payCustomOrder,
  cancelCustomOrder,
  fetchMyOffers,
  acceptOffer,
  declineOffer,
  counterOffer,
  withdrawOffer,
  uploadAvatar,
  type MessageThread,
  type MyOrder,
  type Offer,
} from '@/lib/supabaseData';
import { ListingCard } from '@/components/ListingCard';
import { ListingRefRow } from '@/components/ListingRefRow';
import { DeliveryPanel, METHOD_LABEL } from '@/components/DeliveryPanel';
import { ReviewForm } from '@/components/ReviewForm';
import { FitProfileForm } from '@/components/FitProfileForm';
import { PayoutsPanel } from '@/components/PayoutsPanel';
import { MessagesInbox } from '@/components/MessagesInbox';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { formatPrice, formatDateTime, timeAgo } from '@/lib/format';
import type { Listing } from '@/types';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

const TABS = ['My listings', 'Saved', 'Messages', 'Offers', 'Orders', 'Payouts', 'Fit profile'] as const;

// A buyer and a seller side both live under Offers and Orders — this toggle
// (shared across both tabs, rather than one each) lets someone flip between
// "what am I buying" and "what am I selling" without losing their place.
function RoleToggle({
  value,
  onChange,
}: {
  value: 'buyer' | 'seller';
  onChange: (v: 'buyer' | 'seller') => void;
}) {
  return (
    <div className="mb-5 inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-1">
      {(['buyer', 'seller'] as const).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            value === r
              ? 'bg-[var(--color-ink)] text-white'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          {r === 'buyer' ? 'Buying' : 'Selling'}
        </button>
      ))}
    </div>
  );
}

// Expanded, in-place detail for one order/offer row — clicking the listing
// reference reveals this instead of leaving the tab for the listing page,
// which may no longer even exist once an item has sold.
function TransactionDetails({
  id,
  createdAt,
  amount,
  currency,
  counterpartyName,
  role,
  statusLabel,
  platformFeeAmount,
  listingLink,
  extra,
}: {
  id: string;
  createdAt: string;
  amount: number;
  currency: MyOrder['currency'];
  counterpartyName: string;
  role: 'buyer' | 'seller';
  statusLabel: string;
  platformFeeAmount?: number;
  listingLink?: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-[var(--color-paper)] p-4 text-xs text-[var(--color-ink-soft)] sm:grid-cols-3">
      <div>
        <p className="font-medium text-[var(--color-ink)]">Status</p>
        <p>{statusLabel}</p>
      </div>
      <div>
        <p className="font-medium text-[var(--color-ink)]">{role === 'buyer' ? 'Seller' : 'Buyer'}</p>
        <p>{counterpartyName}</p>
      </div>
      <div>
        <p className="font-medium text-[var(--color-ink)]">Date</p>
        <p>{formatDateTime(createdAt)}</p>
      </div>
      <div>
        <p className="font-medium text-[var(--color-ink)]">Amount</p>
        <p>{formatPrice(amount, currency)}</p>
      </div>
      {platformFeeAmount !== undefined && role === 'seller' && (
        <>
          <div>
            <p className="font-medium text-[var(--color-ink)]">Commission</p>
            <p>−{formatPrice(platformFeeAmount, currency)}</p>
          </div>
          <div>
            <p className="font-medium text-[var(--color-ink)]">Payout</p>
            <p className="font-medium text-[var(--color-moss)]">
              {formatPrice(amount - platformFeeAmount, currency)}
            </p>
          </div>
        </>
      )}
      <div>
        <p className="font-medium text-[var(--color-ink)]">Reference</p>
        <p className="font-mono">{id.slice(0, 8)}</p>
      </div>
      {extra}
      {listingLink && (
        <Link
          to={listingLink}
          className="col-span-full inline-flex w-fit items-center gap-1 text-[var(--color-brand-dark)] hover:underline"
        >
          View listing <ExternalLink size={12} />
        </Link>
      )}
    </div>
  );
}

// A completed order — however it was paid for (Buy now, an accepted offer,
// or a seller-sent invoice) — should always be reviewable. This is the one
// place that covers all three, rather than only the direct-purchase
// checkout-confirmation redirect (see PurchaseCheckoutConfirm.tsx), which
// never fires for the other two and left them permanently unreviewable.
function OrderReviewSection({
  order,
  reviewerId,
  onSubmitted,
}: {
  order: MyOrder;
  reviewerId: string;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!order.listingId) return null;
  if (order.alreadyReviewed || submitted) {
    return <p className="col-span-full border-t border-[var(--color-line)] pt-3 text-[var(--color-moss)]">Reviewed — thanks!</p>;
  }

  return (
    <div className="col-span-full border-t border-[var(--color-line)] pt-3">
      {open ? (
        <ReviewForm
          orderId={order.id}
          listingId={order.listingId}
          reviewerId={reviewerId}
          sellerId={order.counterpartyId}
          sellerName={order.counterpartyName}
          compact
          onSubmitted={() => {
            setSubmitted(true);
            onSubmitted();
          }}
        />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-[var(--color-line)] px-3 py-1.5 font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
        >
          Leave a review
        </button>
      )}
    </div>
  );
}

export function Account() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>(() => {
    const t = searchParams.get('tab');
    if (t === 'payouts') return 'Payouts';
    if (t === 'orders' || t === 'invoices') return 'Orders';
    if (t === 'offers') return 'Offers';
    return 'My listings';
  });
  const [viewRole, setViewRole] = useState<'buyer' | 'seller'>('buyer');
  const [myListings, setMyListings] = useState<Listing[] | null>(null);
  const [saved, setSaved] = useState<Listing[] | null>(null);
  const [messages, setMessages] = useState<MessageThread[] | null>(null);
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [offerBusyId, setOfferBusyId] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [counterOpenId, setCounterOpenId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  // Clicking a listing reference in Orders/Offers expands the transaction's
  // own details in place, rather than leaving the tab for the listing page.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function refreshOrders() {
    if (user) fetchMyOrders(user.id).then(setOrders);
  }

  async function handlePayInvoice(invoiceId: string) {
    setInvoiceError(null);
    setInvoiceBusyId(invoiceId);
    try {
      const origin = window.location.origin;
      const url = await payCustomOrder(invoiceId, `${origin}/account?tab=orders`, `${origin}/account?tab=orders`);
      window.location.href = url;
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Something went wrong starting payment.');
      setInvoiceBusyId(null);
    }
  }

  async function handleCancelInvoice(invoiceId: string) {
    setInvoiceError(null);
    setInvoiceBusyId(invoiceId);
    try {
      await cancelCustomOrder(invoiceId);
      refreshOrders();
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Could not cancel that invoice.');
    } finally {
      setInvoiceBusyId(null);
    }
  }

  function refreshOffers() {
    if (user) fetchMyOffers(user.id).then(setOffers);
  }

  async function handleAcceptOffer(offerId: string) {
    setOfferError(null);
    setOfferBusyId(offerId);
    try {
      await acceptOffer(offerId);
      refreshOffers();
      refreshOrders();
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : 'Could not accept that offer.');
    } finally {
      setOfferBusyId(null);
    }
  }

  async function handleDeclineOffer(offerId: string) {
    setOfferError(null);
    setOfferBusyId(offerId);
    try {
      await declineOffer(offerId);
      refreshOffers();
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : 'Could not decline that offer.');
    } finally {
      setOfferBusyId(null);
    }
  }

  async function handleWithdrawOffer(offerId: string) {
    setOfferError(null);
    setOfferBusyId(offerId);
    try {
      await withdrawOffer(offerId);
      refreshOffers();
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : 'Could not withdraw that offer.');
    } finally {
      setOfferBusyId(null);
    }
  }

  async function handleSendCounter(offerId: string) {
    setOfferError(null);
    if (!(Number(counterAmount) > 0)) {
      setOfferError('Enter a counter amount greater than zero.');
      return;
    }
    setOfferBusyId(offerId);
    try {
      await counterOffer(offerId, Number(counterAmount));
      setCounterOpenId(null);
      setCounterAmount('');
      refreshOffers();
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : 'Could not send that counter-offer.');
    } finally {
      setOfferBusyId(null);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await uploadAvatar(user.id, file);
      await refreshProfile();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not upload that picture.');
    } finally {
      setAvatarUploading(false);
    }
  }

  function refreshMessages() {
    if (user) fetchMessageThreads(user.id).then(setMessages);
  }

  useEffect(() => {
    if (!user) return;
    fetchListingsBySeller(user.id).then(setMyListings);
    fetchSavedListings(user.id).then(setSaved);
    fetchMyOrders(user.id).then(setOrders);
    fetchMyOffers(user.id).then(setOffers);
    fetchMessageThreads(user.id).then(setMessages);
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Once an accepted offer's invoice is actually paid, it's a completed
  // sale living in the Orders tab now — no longer something to act on or
  // track here.
  const visibleOffers = offers?.filter((o) => !(o.status === 'accepted' && o.orderPaid)) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center gap-4">
        <button
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          aria-label="Change profile picture"
          className="group relative h-14 w-14 shrink-0 rounded-full disabled:opacity-70"
        >
          <Avatar name={profile?.name ?? user.email ?? '?'} avatarUrl={profile?.avatar_url} className="h-14 w-14 text-xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition group-hover:bg-black/40 group-hover:text-white">
            {avatarUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </button>
        <div>
          <div className="flex items-center gap-1.5 text-xl font-medium">
            {profile?.name ?? user.email}{' '}
            {profile?.verified && <BadgeCheck size={16} className="text-[var(--color-moss)]" />}
          </div>
          <p className="text-sm text-[var(--color-ink-soft)]">
            {profile?.club ? `${profile.club}` : user.email}
          </p>
          {avatarError && <p className="mt-1 text-xs text-[var(--color-brand-dark)]">{avatarError}</p>}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-6 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${
              tab === t
                ? 'border-[var(--color-brand)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t}
            {t === 'Messages' && messages && messages.some((m) => m.hasUnread) && (
              <span className="ml-1.5 text-[var(--color-brand)]">
                ({messages.filter((m) => m.hasUnread).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'My listings' &&
          (myListings === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : myListings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              <PackagePlus size={28} />
              <p>You haven't listed anything yet.</p>
              <Link
                to="/sell"
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Sell equipment
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex justify-end">
                <Link
                  to="/sell/fleet/new"
                  className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                >
                  <Boxes size={13} /> List club gear
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {myListings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </div>
          ))}

        {tab === 'Saved' &&
          (saved === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : saved.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              Nothing saved yet — tap the heart on a real listing to keep it here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ))}

        {tab === 'Messages' && user && (
          <MessagesInbox userId={user.id} threads={messages} onThreadsChanged={refreshMessages} />
        )}

        {tab === 'Offers' && (
          <div>
            <RoleToggle value={viewRole} onChange={setViewRole} />

            <div className="mb-8">
              <h3 className="mb-3 text-sm font-medium text-[var(--color-ink-soft)]">
                {viewRole === 'buyer' ? 'To pay' : 'Invoices sent'}
              </h3>
              {orders === null ? (
                <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
              ) : (
                <>
                  {invoiceError && (
                    <p className="mb-3 rounded-xl bg-[var(--color-brand-soft)] px-4 py-2 text-sm text-[var(--color-brand-dark)]">
                      {invoiceError}
                    </p>
                  )}
                  {orders.filter((o) => o.role === viewRole && o.status === 'pending').length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-10 text-center text-sm text-[var(--color-ink-soft)]">
                      {viewRole === 'buyer'
                        ? 'No invoices waiting on you.'
                        : "You haven't sent an invoice yet — send one from a club gear lot you own."}
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                      {orders
                        .filter((o) => o.role === viewRole && o.status === 'pending')
                        .map((inv) => {
                          const expanded = expandedId === inv.id;
                          const link = inv.listingId
                            ? `/listing/${inv.listingId}`
                            : inv.bundleId
                              ? `/fleet/${inv.bundleId}`
                              : null;
                          return (
                            <div key={inv.id} className="p-4">
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => setExpandedId(expanded ? null : inv.id)}
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                  <ChevronDown
                                    size={14}
                                    className={`shrink-0 text-[var(--color-ink-soft)] transition-transform ${
                                      expanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <ListingRefRow
                                      title={inv.title}
                                      photos={inv.photos}
                                      sport={inv.sport}
                                      location={inv.location}
                                      country={inv.country}
                                    />
                                  </span>
                                </button>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-medium">{formatPrice(inv.amount, inv.currency)}</p>
                                  <p className="text-xs text-[var(--color-ink-soft)]">
                                    {viewRole === 'buyer' ? 'from' : 'to'} {inv.counterpartyName} ·{' '}
                                    {timeAgo(inv.createdAt.slice(0, 10))}
                                  </p>
                                </div>
                                {viewRole === 'buyer' ? (
                                  <div className="flex shrink-0 gap-2">
                                    <button
                                      onClick={() => handlePayInvoice(inv.id)}
                                      disabled={invoiceBusyId === inv.id}
                                      className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                                    >
                                      {invoiceBusyId === inv.id ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <CreditCard size={13} />
                                      )}
                                      Pay now
                                    </button>
                                    <button
                                      onClick={() => handleCancelInvoice(inv.id)}
                                      disabled={invoiceBusyId === inv.id}
                                      className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleCancelInvoice(inv.id)}
                                    disabled={invoiceBusyId === inv.id}
                                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                                  >
                                    {invoiceBusyId === inv.id ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <X size={13} />
                                    )}
                                    Cancel
                                  </button>
                                )}
                              </div>
                              {expanded && (
                                <TransactionDetails
                                  id={inv.id}
                                  createdAt={inv.createdAt}
                                  amount={inv.amount}
                                  currency={inv.currency}
                                  counterpartyName={inv.counterpartyName}
                                  role={viewRole}
                                  statusLabel={viewRole === 'buyer' ? 'Awaiting your payment' : 'Awaiting payment'}
                                  platformFeeAmount={inv.platformFeeAmount}
                                  listingLink={link}
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-[var(--color-ink-soft)]">Offers</h3>
              {visibleOffers === null ? (
                <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
              ) : visibleOffers.filter((o) => o.role === viewRole).length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
                  <Tag size={28} />
                  <p>
                    {viewRole === 'buyer'
                      ? 'No offers yet — make one from a listing.'
                      : 'No offers yet — wait for one on your listings.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {offerError && (
                    <p className="rounded-xl bg-[var(--color-brand-soft)] px-4 py-2 text-sm text-[var(--color-brand-dark)]">
                      {offerError}
                    </p>
                  )}
                  <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                    {visibleOffers
                      .filter((o) => o.role === viewRole)
                      .map((offer) => {
                  const myTurn = offer.status === 'pending' && offer.proposedBy !== offer.role;
                  const myOwnProposal = offer.status === 'pending' && offer.proposedBy === offer.role;
                  const expanded = expandedId === offer.id;
                  const listingLink = `/listing/${offer.listingId}`;
                  return (
                    <div key={offer.id} className="p-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setExpandedId(expanded ? null : offer.id)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        >
                          <ChevronDown
                            size={14}
                            className={`mt-1 shrink-0 text-[var(--color-ink-soft)] transition-transform ${
                              expanded ? 'rotate-180' : ''
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                          <ListingRefRow
                            title={offer.listingTitle}
                            photos={offer.photos}
                            sport={offer.sport}
                            location={offer.location}
                            country={offer.country}
                          />
                          <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">
                            {offer.status === 'pending' ? (
                              <Badge tone={myTurn ? 'brand' : 'neutral'}>
                                {myTurn ? 'Your turn' : `Waiting on ${offer.counterpartyName.split(' ')[0]}`}
                              </Badge>
                            ) : (
                              <Badge tone={offer.status === 'accepted' ? 'moss' : 'neutral'}>
                                {offer.status === 'accepted'
                                  ? 'Accepted'
                                  : offer.status === 'declined'
                                    ? 'Declined'
                                    : 'Withdrawn'}
                              </Badge>
                            )}
                          </p>
                          {offer.message && (
                            <p className="mt-1 text-xs text-[var(--color-ink-soft)]/80">"{offer.message}"</p>
                          )}
                          </span>
                        </button>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium">{formatPrice(offer.amount, offer.currency)}</p>
                          <p className="text-xs text-[var(--color-ink-soft)]">
                            {offer.role === 'buyer' ? 'to' : 'from'} {offer.counterpartyName} ·{' '}
                            {timeAgo(offer.updatedAt.slice(0, 10))}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {myTurn && (
                            <>
                              <button
                                onClick={() => handleAcceptOffer(offer.id)}
                                disabled={offerBusyId === offer.id}
                                className="flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                              >
                                {offerBusyId === offer.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Check size={13} />
                                )}
                                Accept
                              </button>
                              <button
                                onClick={() =>
                                  setCounterOpenId(counterOpenId === offer.id ? null : offer.id)
                                }
                                disabled={offerBusyId === offer.id}
                                className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                              >
                                Counter
                              </button>
                              <button
                                onClick={() => handleDeclineOffer(offer.id)}
                                disabled={offerBusyId === offer.id}
                                className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {myOwnProposal && (
                            <button
                              onClick={() => handleWithdrawOffer(offer.id)}
                              disabled={offerBusyId === offer.id}
                              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-60"
                            >
                              {offerBusyId === offer.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <X size={13} />
                              )}
                              Withdraw
                            </button>
                          )}
                          {offer.status === 'accepted' && (
                            <button
                              onClick={() => setTab('Orders')}
                              className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                            >
                              View order
                            </button>
                          )}
                        </div>
                      </div>

                      {counterOpenId === offer.id && (
                        <div className="ml-14 mt-3 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            autoFocus
                            value={counterAmount}
                            onChange={(e) => setCounterAmount(e.target.value)}
                            placeholder={`Counter (${offer.currency})`}
                            className="w-40 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                          />
                          <button
                            onClick={() => handleSendCounter(offer.id)}
                            disabled={offerBusyId === offer.id}
                            className="rounded-full bg-[var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                          >
                            Send counter
                          </button>
                          <button
                            onClick={() => {
                              setCounterOpenId(null);
                              setCounterAmount('');
                            }}
                            className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {expanded && (
                        <TransactionDetails
                          id={offer.id}
                          createdAt={offer.createdAt}
                          amount={offer.amount}
                          currency={offer.currency}
                          counterpartyName={offer.counterpartyName}
                          role={offer.role}
                          statusLabel={
                            offer.status === 'pending'
                              ? myTurn
                                ? 'Your turn to respond'
                                : `Waiting on ${offer.counterpartyName.split(' ')[0]}`
                              : offer.status === 'accepted'
                                ? 'Accepted'
                                : offer.status === 'declined'
                                  ? 'Declined'
                                  : 'Withdrawn'
                          }
                          listingLink={listingLink}
                          extra={
                            <div>
                              <p className="font-medium text-[var(--color-ink)]">Proposed by</p>
                              <p>
                                {offer.proposedBy === offer.role
                                  ? 'You'
                                  : offer.counterpartyName.split(' ')[0]}
                                {offer.updatedAt !== offer.createdAt &&
                                  ` · last updated ${formatDateTime(offer.updatedAt)}`}
                              </p>
                            </div>
                          }
                        />
                      )}
                    </div>
                  );
                })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Orders' && (
          <div>
            <RoleToggle value={viewRole} onChange={setViewRole} />

            {orders === null ? (
              <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
            ) : orders.filter((o) => o.role === viewRole && o.status === 'paid').length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-10 text-center text-sm text-[var(--color-ink-soft)]">
                {viewRole === 'buyer' ? 'Nothing bought yet.' : 'Nothing sold yet.'}
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                {orders
                  .filter((o) => o.role === viewRole && o.status === 'paid')
                  .map((inv) => {
                    const link = inv.listingId
                      ? `/listing/${inv.listingId}`
                      : inv.bundleId
                        ? `/fleet/${inv.bundleId}`
                        : null;
                    const payout = inv.amount - inv.platformFeeAmount;
                    const expanded = expandedId === inv.id;
                    return (
                      <div key={inv.id} className="p-4">
                        <button
                          onClick={() => setExpandedId(expanded ? null : inv.id)}
                          className="flex w-full items-center gap-4 text-left"
                        >
                          <ChevronDown
                            size={14}
                            className={`shrink-0 text-[var(--color-ink-soft)] transition-transform ${
                              expanded ? 'rotate-180' : ''
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <ListingRefRow
                              title={inv.title}
                              photos={inv.photos}
                              sport={inv.sport}
                              location={inv.location}
                              country={inv.country}
                            />
                            {viewRole === 'seller' && (
                              <p className="mt-1 text-xs text-[var(--color-ink-soft)]/80">
                                −{formatPrice(inv.platformFeeAmount, inv.currency)} commission ={' '}
                                <span className="font-medium text-[var(--color-moss)]">
                                  {formatPrice(payout, inv.currency)} payout
                                </span>
                              </p>
                            )}
                            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-ink-soft)]/80">
                              <Truck size={11} className="shrink-0" />
                              {inv.deliveryMethod
                                ? `${METHOD_LABEL[inv.deliveryMethod]}${inv.trackingReference ? ` · ${inv.trackingReference}` : ''}`
                                : inv.deliveryNotes
                                  ? inv.deliveryNotes.length > 40
                                    ? `${inv.deliveryNotes.slice(0, 40)}…`
                                    : inv.deliveryNotes
                                  : 'Delivery not yet arranged'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium">{formatPrice(inv.amount, inv.currency)}</p>
                            <p className="text-xs text-[var(--color-ink-soft)]">
                              {viewRole === 'buyer' ? 'from' : 'to'} {inv.counterpartyName} ·{' '}
                              {timeAgo(inv.createdAt.slice(0, 10))}
                            </p>
                          </div>
                        </button>
                        {expanded && (
                          <TransactionDetails
                            id={inv.id}
                            createdAt={inv.createdAt}
                            amount={inv.amount}
                            currency={inv.currency}
                            counterpartyName={inv.counterpartyName}
                            role={viewRole}
                            statusLabel="Paid"
                            platformFeeAmount={inv.platformFeeAmount}
                            listingLink={link}
                            extra={
                              <>
                                {viewRole === 'buyer' && (
                                  <OrderReviewSection order={inv} reviewerId={user.id} onSubmitted={refreshOrders} />
                                )}
                                <DeliveryPanel order={inv} onChanged={refreshOrders} />
                              </>
                            }
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {tab === 'Payouts' && <PayoutsPanel />}

        {tab === 'Fit profile' && <FitProfileForm userId={user.id} />}
      </div>
    </div>
  );
}
