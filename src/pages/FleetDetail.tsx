import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Boxes, Loader2, MessageCircle, Pencil, Send, Star, CheckCircle2, Trash2 } from 'lucide-react';
import {
  fetchBundle,
  findBuyerByEmail,
  createCustomOrder,
  hasMessaged,
  sendMessage,
  updateFleetBundleShared,
  cancelFleetBundle,
  type BuyerLookup,
} from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { ListingCard } from '@/components/ListingCard';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { AuthModal } from '@/components/AuthModal';
import { DeliverySuggestion } from '@/components/DeliverySuggestion';
import { EditFleetItemModal } from '@/components/EditFleetItemModal';
import { formatPrice } from '@/lib/format';
import type { FleetBundle, Listing } from '@/types';

function InvoicePanel({ bundle }: { bundle: FleetBundle }) {
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyer, setBuyer] = useState<BuyerLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(bundle.listings.map((l) => l.id)));
  const [amount, setAmount] = useState(String(bundle.listings.reduce((sum, l) => sum + (l.price ?? 0), 0)));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const currency = bundle.listings[0]?.currency ?? 'GBP';

  async function handleLookup() {
    setLookupError(null);
    setBuyer(null);
    setLookingUp(true);
    try {
      setBuyer(await findBuyerByEmail(buyerEmail.trim()));
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Could not look up that email.');
    } finally {
      setLookingUp(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!buyer || selected.size === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createCustomOrder(buyer.id, Array.from(selected), Number(amount), currency, bundle.id);
      setSent(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong sending the invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--color-moss-soft)] p-4 text-sm text-[var(--color-moss)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        <span>Invoice sent to {buyer?.name} — they can pay it from their account whenever they're ready.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} className="mt-5 space-y-4 border-t border-[var(--color-line)] pt-5">
      <p className="text-sm font-medium">Send an invoice</p>
      <p className="text-xs text-[var(--color-ink-soft)]">
        Already agreed a deal with a buyer? Invoice them for exactly what you agreed — doesn't have
        to be everything in the lot, or the listed price.
      </p>

      <div>
        <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Buyer's email</label>
        <div className="flex gap-2">
          <input
            type="email"
            required
            value={buyerEmail}
            onChange={(e) => {
              setBuyerEmail(e.target.value);
              setBuyer(null);
            }}
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={!buyerEmail.trim() || lookingUp}
            className="shrink-0 rounded-xl border border-[var(--color-line)] px-3.5 py-2 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
          >
            {lookingUp ? <Loader2 size={14} className="animate-spin" /> : 'Find'}
          </button>
        </div>
        {lookupError && <p className="mt-1 text-xs text-[var(--color-brand-dark)]">{lookupError}</p>}
        {buyer && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-moss)]">
            <CheckCircle2 size={12} /> Found: {buyer.name}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Which items are included?</label>
        <div className="space-y-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
          {bundle.listings.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(l.id)}
                onChange={() => toggle(l.id)}
                className="h-4 w-4 rounded border-[var(--color-line)]"
              />
              {l.title}
              <span className="text-xs text-[var(--color-ink-soft)]">{formatPrice(l.price, l.currency)}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Agreed total ({currency})</label>
        <input
          type="number"
          min={0}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
        />
      </div>

      {submitError && <p className="text-xs text-[var(--color-brand-dark)]">{submitError}</p>}

      <button
        type="submit"
        disabled={!buyer || selected.size === 0 || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
      >
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        Send invoice
      </button>
    </form>
  );
}

export function FleetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  // Mirrors `user` so a resumed post-login action (see requireAuth) always
  // reads the current session, not the stale one captured when it was queued.
  const userRef = useRef(user);
  userRef.current = user;
  const [bundle, setBundle] = useState<FleetBundle | null | undefined>(undefined);
  const [showAuth, setShowAuth] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [editingBundle, setEditingBundle] = useState(false);
  const [bundleTitleDraft, setBundleTitleDraft] = useState('');
  const [bundleDescDraft, setBundleDescDraft] = useState('');
  const [bundleSaving, setBundleSaving] = useState(false);
  const [bundleSaveError, setBundleSaveError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Listing | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancelLot() {
    if (!bundle) return;
    if (
      !confirm(
        `Cancel "${bundle.title}"? It'll come off Club Gear browse — items already sold or messaged about aren't affected. This can't be undone here.`,
      )
    ) {
      return;
    }
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelFleetBundle(bundle.id);
      navigate('/club-gear');
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel this lot.');
      setCancelling(false);
    }
  }

  function refreshBundle() {
    if (!id) return;
    fetchBundle(id)
      .then(setBundle)
      .catch(() => setBundle(null));
  }

  async function saveBundleShared() {
    if (!bundle) return;
    setBundleSaveError(null);
    setBundleSaving(true);
    try {
      await updateFleetBundleShared(bundle.id, { title: bundleTitleDraft, description: bundleDescDraft });
      setBundle({ ...bundle, title: bundleTitleDraft, description: bundleDescDraft });
      setEditingBundle(false);
    } catch (err) {
      setBundleSaveError(err instanceof Error ? err.message : 'Something went wrong saving that.');
    } finally {
      setBundleSaving(false);
    }
  }

  // Runs a queued requireAuth() action once `user` actually reflects the new
  // session — not from AuthModal's success callback directly, since that can
  // fire before React has committed the updated auth state.
  useEffect(() => {
    if (!user || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action();
  }, [user]);

  useEffect(() => {
    if (!id) return;
    fetchBundle(id)
      .then(setBundle)
      .catch(() => setBundle(null));
  }, [id]);

  useEffect(() => {
    const firstListingId = bundle?.listings[0]?.id;
    if (!firstListingId || !user) return;
    hasMessaged(firstListingId, user.id).then(setMessageSent);
  }, [bundle, user]);

  if (bundle === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 text-center">
        <p className="text-[var(--color-ink-soft)]">Listing not found.</p>
        <Link to="/club-gear" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to Club Gear
        </Link>
      </div>
    );
  }

  const total = bundle.listings.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const currency = bundle.listings[0]?.currency ?? 'GBP';
  const isSold = bundle.status === 'sold';
  const isOwner = user?.id === bundle.seller.id;
  const firstListingId = bundle.listings[0]?.id;

  function requireAuth(action: () => void) {
    if (!user) {
      pendingActionRef.current = action;
      setShowAuth(true);
      return;
    }
    action();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        to="/club-gear"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={15} /> Back to Club Gear
      </Link>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">
              <Boxes size={11} /> {bundle.listings.length} items
            </Badge>
            {isSold && <Badge tone="brand">Sold</Badge>}
          </div>

          {editingBundle ? (
            <div className="mt-4 space-y-3">
              <input
                value={bundleTitleDraft}
                onChange={(e) => setBundleTitleDraft(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-2xl outline-none focus:border-[var(--color-ink-soft)]"
              />
              <textarea
                value={bundleDescDraft}
                onChange={(e) => setBundleDescDraft(e.target.value)}
                rows={4}
                className="w-full max-w-xl resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-[15px] outline-none focus:border-[var(--color-ink-soft)]"
              />
              {bundleSaveError && <p className="text-sm text-[var(--color-brand-dark)]">{bundleSaveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveBundleShared}
                  disabled={bundleSaving}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
                >
                  {bundleSaving && <Loader2 size={12} className="animate-spin" />}
                  Save
                </button>
                <button
                  onClick={() => setEditingBundle(false)}
                  className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-start justify-between gap-3">
                <h1 className="text-3xl leading-tight sm:text-4xl">{bundle.title}</h1>
                {isOwner && (
                  <div className="mt-1 flex shrink-0 gap-2">
                    <button
                      onClick={() => {
                        setBundleTitleDraft(bundle.title);
                        setBundleDescDraft(bundle.description);
                        setEditingBundle(true);
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    {bundle.status === 'active' && (
                      <button
                        onClick={handleCancelLot}
                        disabled={cancelling}
                        className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dark)] disabled:opacity-60"
                      >
                        {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Cancel this lot
                      </button>
                    )}
                  </div>
                )}
              </div>
              {cancelError && <p className="mt-2 text-sm text-[var(--color-brand-dark)]">{cancelError}</p>}
              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink)]">
                {bundle.description}
              </p>
            </>
          )}

          <h2 className="mb-4 mt-10 text-lg">What's in this lot</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {bundle.listings.map((l) => (
              <div key={l.id} className="relative">
                <ListingCard listing={l} />
                {isOwner && !l.soldAt && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingItem(l);
                    }}
                    aria-label={`Edit ${l.title}`}
                    className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] shadow-sm hover:bg-white"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl">{formatPrice(total, currency)}</span>
              <span className="text-xs text-[var(--color-ink-soft)]">combined asking price</span>
            </div>

            <Link
              to={`/seller/${bundle.seller.id}`}
              className="mt-5 flex items-center gap-3 border-t border-[var(--color-line)] pt-5 hover:opacity-80"
            >
              <Avatar name={bundle.seller.name} avatarUrl={bundle.seller.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-medium">
                  {bundle.seller.name}
                  {bundle.seller.verified && <BadgeCheck size={14} className="text-[var(--color-moss)]" />}
                </div>
                <div className="truncate text-xs text-[var(--color-ink-soft)]">
                  {bundle.seller.club ?? `Member since ${bundle.seller.memberSince}`}
                </div>
              </div>
            </Link>

            <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-ink-soft)]">
              <span className="flex items-center gap-1">
                <Star size={12} className="fill-[var(--color-brand)] text-[var(--color-brand)]" />
                {bundle.seller.rating.toFixed(1)}
              </span>
              <span>{bundle.seller.salesCount} completed sale{bundle.seller.salesCount === 1 ? '' : 's'}</span>
            </div>

            {!isOwner && bundle.listings[0] && (
              <DeliverySuggestion
                listing={bundle.listings[0]}
                sellerFirstName={bundle.seller.name.split(' ')[0]}
                sellerClub={bundle.seller.club}
                buyerClub={profile?.club}
                shipsInternationally={bundle.listings[0].shipsInternationally}
              />
            )}

            {isOwner ? (
              <InvoicePanel bundle={bundle} />
            ) : isSold ? (
              <div className="mt-5 rounded-xl bg-[var(--color-line)]/40 p-4 text-sm text-[var(--color-ink-soft)]">
                This lot has sold.
              </div>
            ) : messageSent ? (
              <div className="mt-5 rounded-xl bg-[var(--color-moss-soft)] p-4 text-sm text-[var(--color-moss)]">
                Message sent — {bundle.seller.name.split(' ')[0]} typically replies within a day.
              </div>
            ) : (
              <div className="mt-5">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hi ${bundle.seller.name.split(' ')[0]}, we're interested in the whole lot — is it still available?`}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
                <button
                  onClick={() =>
                    requireAuth(async () => {
                      if (!firstListingId || !userRef.current) return;
                      await sendMessage(firstListingId, bundle.seller.id, message);
                      setMessageSent(true);
                    })
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
                >
                  <MessageCircle size={16} /> Message seller
                </button>
                <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)]">
                  Once you've agreed a deal, the seller can send you a secure invoice to pay through
                  Relay.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => {
            pendingActionRef.current = null;
            setShowAuth(false);
          }}
          onAuthenticated={() => setShowAuth(false)}
        />
      )}

      {editingItem && (
        <EditFleetItemModal
          listing={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={refreshBundle}
        />
      )}
    </div>
  );
}
