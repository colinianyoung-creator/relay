import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { METHOD_LABEL } from '@/components/DeliveryPanel';
import { ListingCover } from '@/components/ListingCover';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/lib/auth';
import { formatPrice } from '@/lib/format';
import {
  createPurchaseCheckout,
  fetchListing,
  fetchMyOrders,
  fetchOrderDeliveryOptions,
  payCustomOrder,
} from '@/lib/supabaseData';
import type { Currency, Sport } from '@/types';

type DeliveryMethod = 'collection' | 'courier' | 'freight';

interface CheckoutItem {
  title: string;
  price: number;
  currency: Currency;
  sellerName: string;
  photos?: string[];
  sport: Sport | null;
  location: string | null;
  deliveryMethods: DeliveryMethod[];
  pay: (method: DeliveryMethod) => Promise<string>;
}

/**
 * The review step between "Buy now" (or paying an accepted offer / invoice)
 * and Stripe Checkout. Delivery method is chosen here in Relay's own UI —
 * Stripe's page has no concept of collection vs courier — and the shipping
 * address, when one's needed, is still collected on Stripe's page.
 *
 * Two routes share this page: /checkout/listing/:id (Buy now) and
 * /checkout/order/:id (a pending accepted-offer or custom-invoice order).
 */
export function Checkout({ kind }: { kind: 'listing' | 'order' }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [item, setItem] = useState<CheckoutItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    const origin = window.location.origin;

    async function load() {
      if (kind === 'listing') {
        const listing = await fetchListing(id!);
        if (!listing) throw new Error("We couldn't find that listing.");
        if (listing.soldAt) throw new Error('This listing has already sold.');
        if (listing.price === null) throw new Error("This listing isn't available to buy directly.");
        if (listing.seller.id === user!.id) throw new Error("You can't buy your own listing.");
        const methods = listing.deliveryMethods?.length ? listing.deliveryMethods : (['courier'] as DeliveryMethod[]);
        return {
          title: listing.title,
          price: listing.price,
          currency: listing.currency,
          sellerName: listing.seller.name,
          photos: listing.photos,
          sport: listing.sport,
          location: listing.location,
          deliveryMethods: methods,
          pay: (m: DeliveryMethod) =>
            createPurchaseCheckout(
              listing.id,
              m,
              `${origin}/purchase/confirm?listing_id=${listing.id}`,
              `${origin}/listing/${listing.id}`,
            ),
        } satisfies CheckoutItem;
      }
      const orders = await fetchMyOrders(user!.id);
      const order = orders.find((o) => o.id === id && o.role === 'buyer' && o.status === 'pending');
      if (!order) throw new Error("We couldn't find an unpaid order to check out.");
      const methods = await fetchOrderDeliveryOptions(order.id);
      return {
        title: order.title,
        price: order.amount,
        currency: order.currency,
        sellerName: order.counterpartyName,
        photos: order.photos ?? undefined,
        sport: order.sport,
        location: order.location,
        deliveryMethods: methods,
        pay: (m: DeliveryMethod) =>
          payCustomOrder(order.id, m, `${origin}/account?tab=orders`, `${origin}/account?tab=orders`),
      } satisfies CheckoutItem;
    }

    load()
      .then((result) => {
        if (cancelled) return;
        setItem(result);
        setMethod(result.deliveryMethods[0] ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this checkout.');
      });
    return () => {
      cancelled = true;
    };
  }, [id, kind, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !method) return;
    setError(null);
    setSubmitting(true);
    try {
      window.location.href = await item.pay(method);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong starting checkout.');
      setSubmitting(false);
    }
  }

  function goBack() {
    navigate(kind === 'listing' ? `/listing/${id}` : '/account?tab=orders');
  }

  const spinner = (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" size={32} />
    </div>
  );

  if (authLoading) return spinner;

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl">Sign in to check out</h1>
        <AuthModal onClose={() => navigate(-1)} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl">Can't start checkout</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">{loadError}</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          Back to browse
        </Link>
      </div>
    );
  }

  if (!item) return spinner;

  const firstName = item.sellerName.split(' ')[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <button
        onClick={goBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={15} />
        Back
      </button>
      <h1 className="text-3xl">Review your order</h1>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6 md:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
            <h2 className="mb-3 text-sm font-medium">Delivery</h2>
            {item.deliveryMethods.length === 0 ? (
              <p className="rounded-xl border border-[var(--color-brand)] bg-[var(--color-brand-soft)] px-3.5 py-2 text-sm text-[var(--color-brand-dark)]">
                These items don't share a common delivery method — message {firstName} to sort out
                delivery before paying.
              </p>
            ) : (
              <div className="space-y-2">
                {item.deliveryMethods.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] px-3.5 py-3 text-sm has-[:checked]:border-[var(--color-ink)]"
                  >
                    <input
                      type="radio"
                      name="delivery-method"
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="h-4 w-4"
                    />
                    {METHOD_LABEL[m]}
                  </label>
                ))}
              </div>
            )}
            {method !== null && method !== 'collection' && (
              <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                You'll enter your shipping address on the next step, at checkout.
              </p>
            )}
            {method === 'collection' && (
              <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                No address needed — you'll arrange a pickup time with {firstName} directly.
              </p>
            )}
          </section>

          <section className="flex gap-3 rounded-2xl bg-[var(--color-paper)] p-5 text-sm text-[var(--color-ink-soft)]">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[var(--color-moss)]" />
            <p>
              Your payment is held securely and only released to the seller once you confirm the
              item has arrived.
            </p>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 md:sticky md:top-6">
          <div className="flex gap-3">
            {item.sport && (
              <ListingCover sport={item.sport} photos={item.photos} className="h-16 w-16 shrink-0 rounded-lg" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Sold by {item.sellerName}
                {item.location ? ` · ${item.location}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-4 text-sm">
            <span>Total</span>
            <span className="text-lg font-medium">{formatPrice(item.price, item.currency)}</span>
          </div>

          {error && <p className="mt-3 text-sm text-[var(--color-brand-dark)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !method}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Continue to payment
          </button>
        </aside>
      </form>
    </div>
  );
}
