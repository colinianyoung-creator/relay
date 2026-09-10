import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Boxes, Loader2, MessageCircle, Send, Star, CheckCircle2 } from 'lucide-react';
import { fetchBundle, findBuyerByEmail, createCustomOrder, hasMessaged, sendMessage, type BuyerLookup } from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { ListingCard } from '@/components/ListingCard';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { AuthModal } from '@/components/AuthModal';
import { formatPrice } from '@/lib/format';
import type { FleetBundle } from '@/types';

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
  const { user } = useAuth();
  const [bundle, setBundle] = useState<FleetBundle | null | undefined>(undefined);
  const [showAuth, setShowAuth] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);

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
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-[var(--color-ink-soft)]">Listing not found.</p>
        <Link to="/fleets" className="mt-4 inline-block text-[var(--color-brand)] underline">
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
      setShowAuth(true);
      return;
    }
    action();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/fleets"
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

          <h1 className="mt-4 text-3xl leading-tight sm:text-4xl">{bundle.title}</h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink)]">
            {bundle.description}
          </p>

          <h2 className="mb-4 mt-10 text-lg">What's in this lot</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {bundle.listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
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
                      if (!firstListingId || !user) return;
                      await sendMessage(firstListingId, user.id, message);
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
