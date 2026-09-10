import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, MessageCircle, PackagePlus, Loader2, Search, Camera, Boxes, Receipt, CreditCard, X, Tag, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  fetchListingsBySeller,
  fetchSavedListings,
  fetchSentMessages,
  fetchWantedPostsByBuyer,
  fetchSentWantedMessages,
  fetchMyInvoices,
  payCustomOrder,
  cancelCustomOrder,
  fetchMyOffers,
  acceptOffer,
  declineOffer,
  counterOffer,
  withdrawOffer,
  uploadAvatar,
  type MessageThread,
  type WantedMessageThread,
  type Invoice,
  type Offer,
} from '@/lib/supabaseData';
import { ListingCard } from '@/components/ListingCard';
import { FitProfileForm } from '@/components/FitProfileForm';
import { PayoutsPanel } from '@/components/PayoutsPanel';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { formatPrice, timeAgo } from '@/lib/format';
import type { Listing, WantedPost } from '@/types';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

const TABS = ['My listings', 'Saved', 'Wanted posts', 'Messages', 'Offers', 'Invoices', 'Payouts', 'Fit profile'] as const;

type UnifiedMessage =
  | ({ kind: 'listing' } & MessageThread)
  | ({ kind: 'wanted' } & WantedMessageThread);

export function Account() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>(() => {
    const t = searchParams.get('tab');
    if (t === 'payouts') return 'Payouts';
    if (t === 'invoices') return 'Invoices';
    if (t === 'offers') return 'Offers';
    return 'My listings';
  });
  const [myListings, setMyListings] = useState<Listing[] | null>(null);
  const [saved, setSaved] = useState<Listing[] | null>(null);
  const [wantedPosts, setWantedPosts] = useState<WantedPost[] | null>(null);
  const [messages, setMessages] = useState<UnifiedMessage[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [offerBusyId, setOfferBusyId] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [counterOpenId, setCounterOpenId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function refreshInvoices() {
    if (user) fetchMyInvoices(user.id).then(setInvoices);
  }

  async function handlePayInvoice(invoiceId: string) {
    setInvoiceError(null);
    setInvoiceBusyId(invoiceId);
    try {
      const origin = window.location.origin;
      const url = await payCustomOrder(invoiceId, `${origin}/account?tab=invoices`, `${origin}/account?tab=invoices`);
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
      refreshInvoices();
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
      refreshInvoices();
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

  useEffect(() => {
    if (!user) return;
    fetchListingsBySeller(user.id).then(setMyListings);
    fetchSavedListings(user.id).then(setSaved);
    fetchWantedPostsByBuyer(user.id).then(setWantedPosts);
    fetchMyInvoices(user.id).then(setInvoices);
    fetchMyOffers(user.id).then(setOffers);
    Promise.all([fetchSentMessages(user.id), fetchSentWantedMessages(user.id)]).then(
      ([listingMsgs, wantedMsgs]) => {
        const unified: UnifiedMessage[] = [
          ...listingMsgs.map((m) => ({ kind: 'listing' as const, ...m })),
          ...wantedMsgs.map((m) => ({ kind: 'wanted' as const, ...m })),
        ].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        setMessages(unified);
      },
    );
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
            {t === 'Messages' && messages && messages.length > 0 && (
              <span className="ml-1.5 text-[var(--color-brand)]">({messages.length})</span>
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
                List equipment
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex justify-end">
                <Link
                  to="/sell/fleet/new"
                  className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                >
                  <Boxes size={13} /> Create fleet bundle
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

        {tab === 'Wanted posts' &&
          (wantedPosts === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : wantedPosts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              <Search size={28} />
              <p>You haven't posted a want yet.</p>
              <Link
                to="/wanted/new"
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Post what you need
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
              {wantedPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/wanted/${post.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--color-paper)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{post.title}</span>
                      <Badge tone={post.status === 'fulfilled' ? 'moss' : 'brand'}>
                        {post.status === 'fulfilled' ? 'Found' : 'Open'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                      {post.maxPrice
                        ? `Up to ${formatPrice(post.maxPrice, post.currency)}`
                        : 'Any budget'}{' '}
                      · posted {timeAgo(post.createdAt.slice(0, 10))}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ))}

        {tab === 'Messages' &&
          (messages === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              No messages sent yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
              {messages.map((msg) => (
                <div
                  key={(msg.kind === 'listing' ? msg.listingId : msg.wantedId) + msg.sentAt}
                  className="flex items-center gap-4 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
                    <MessageCircle size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {msg.kind === 'listing'
                          ? 'You messaged about this listing'
                          : "You offered kit for this wanted post"}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                        {timeAgo(msg.sentAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="truncate text-sm text-[var(--color-ink-soft)]">
                      {msg.body || '(no message text)'}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]/80">
                      Re:{' '}
                      {msg.kind === 'listing' ? (
                        <>
                          {msg.listingTitle} · {formatPrice(msg.listingPrice, msg.listingCurrency)}
                        </>
                      ) : (
                        <>
                          {msg.wantedTitle}
                          {msg.wantedMaxPrice
                            ? ` · up to ${formatPrice(msg.wantedMaxPrice, msg.wantedCurrency)}`
                            : ''}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === 'Offers' &&
          (offers === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              <Tag size={28} />
              <p>No offers yet — make one from a listing, or wait for one on yours.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offerError && (
                <p className="rounded-xl bg-[var(--color-brand-soft)] px-4 py-2 text-sm text-[var(--color-brand-dark)]">
                  {offerError}
                </p>
              )}
              <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                {offers.map((offer) => {
                  const myTurn = offer.status === 'pending' && offer.proposedBy !== offer.role;
                  const myOwnProposal = offer.status === 'pending' && offer.proposedBy === offer.role;
                  return (
                    <div key={offer.id} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
                          <Tag size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {formatPrice(offer.amount, offer.currency)}{' '}
                              {offer.role === 'buyer' ? 'to' : 'from'} {offer.counterpartyName}
                            </span>
                            <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                              {timeAgo(offer.updatedAt.slice(0, 10))}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-ink-soft)]">
                            {offer.listingTitle}
                            {offer.status === 'pending' && (
                              <>
                                {' · '}
                                <Badge tone={myTurn ? 'brand' : 'neutral'}>
                                  {myTurn ? 'Your turn' : `Waiting on ${offer.counterpartyName.split(' ')[0]}`}
                                </Badge>
                              </>
                            )}
                            {offer.status !== 'pending' && (
                              <>
                                {' · '}
                                <Badge tone={offer.status === 'accepted' ? 'moss' : 'neutral'}>
                                  {offer.status === 'accepted'
                                    ? 'Accepted'
                                    : offer.status === 'declined'
                                      ? 'Declined'
                                      : 'Withdrawn'}
                                </Badge>
                              </>
                            )}
                          </p>
                          {offer.message && (
                            <p className="mt-1 text-xs text-[var(--color-ink-soft)]/80">"{offer.message}"</p>
                          )}
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
                              onClick={() => setTab('Invoices')}
                              className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                            >
                              View invoice
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {tab === 'Invoices' &&
          (invoices === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : (
            <div className="space-y-8">
              {invoiceError && (
                <p className="rounded-xl bg-[var(--color-brand-soft)] px-4 py-2 text-sm text-[var(--color-brand-dark)]">
                  {invoiceError}
                </p>
              )}

              <div>
                <h3 className="mb-3 text-sm font-medium text-[var(--color-ink-soft)]">To pay</h3>
                {invoices.filter((i) => i.role === 'buyer' && i.status === 'pending').length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-10 text-center text-sm text-[var(--color-ink-soft)]">
                    No invoices waiting on you.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                    {invoices
                      .filter((i) => i.role === 'buyer' && i.status === 'pending')
                      .map((inv) => (
                        <div key={inv.id} className="flex items-center gap-4 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
                            <Receipt size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">
                                {formatPrice(inv.amount, inv.currency)} from {inv.counterpartyName}
                              </span>
                              <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                                {timeAgo(inv.createdAt.slice(0, 10))}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--color-ink-soft)]">
                              {inv.itemCount} item{inv.itemCount === 1 ? '' : 's'}
                            </p>
                          </div>
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
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-[var(--color-ink-soft)]">Sent</h3>
                {invoices.filter((i) => i.role === 'seller').length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-10 text-center text-sm text-[var(--color-ink-soft)]">
                    You haven't sent an invoice yet — send one from a fleet bundle you own.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
                    {invoices
                      .filter((i) => i.role === 'seller')
                      .map((inv) => (
                        <div key={inv.id} className="flex items-center gap-4 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
                            <Receipt size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">
                                {formatPrice(inv.amount, inv.currency)} to {inv.counterpartyName}
                              </span>
                              <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                                {timeAgo(inv.createdAt.slice(0, 10))}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--color-ink-soft)]">
                              {inv.itemCount} item{inv.itemCount === 1 ? '' : 's'} ·{' '}
                              <Badge
                                tone={
                                  inv.status === 'paid' ? 'moss' : inv.status === 'cancelled' ? 'neutral' : 'brand'
                                }
                              >
                                {inv.status === 'paid' ? 'Paid' : inv.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                              </Badge>
                            </p>
                          </div>
                          {inv.status === 'pending' && (
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
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}

        {tab === 'Payouts' && <PayoutsPanel />}

        {tab === 'Fit profile' && <FitProfileForm userId={user.id} />}
      </div>
    </div>
  );
}
