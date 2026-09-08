import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Boxes, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchListingsBySeller, createFleetBundle } from '@/lib/supabaseData';
import { ListingCover } from '@/components/ListingCover';
import { formatPrice } from '@/lib/format';
import type { Listing } from '@/types';

export function CreateFleetBundle() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchListingsBySeller(user.id).then(setListings);
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

  // Only your own unsold, not-already-bundled, priced, fully-published
  // listings can go into a new bundle. Excluding fee_status 'pending' isn't
  // cosmetic — RLS hides an unpaid listing from everyone but its own
  // seller, so a bundle built from pending listings would look completely
  // empty to any real buyer.
  const eligible =
    listings?.filter((l) => !l.soldAt && !l.bundleId && l.price !== null && l.feeStatus !== 'pending') ?? null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size < 2) {
      setError('Pick at least 2 listings to make a bundle worthwhile.');
      return;
    }
    const chosen = (eligible ?? []).filter((l) => selected.has(l.id));
    if (new Set(chosen.map((l) => l.currency)).size > 1) {
      setError(
        'These listings are priced in different currencies — a single checkout needs one currency, so pick listings that all use the same one.',
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const bundleId = await createFleetBundle(user!.id, title, description, Array.from(selected));
      navigate(`/fleet/${bundleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  const total = (eligible ?? [])
    .filter((l) => selected.has(l.id))
    .reduce((sum, l) => sum + (l.price ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center gap-2">
        <Boxes size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl sm:text-3xl">Create a fleet bundle</h1>
      </div>
      <p className="mt-2 max-w-xl text-[15px] text-[var(--color-ink-soft)]">
        Group several listings you've already posted into one lot for a fleet buyer to consider
        together.
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Starting from scratch?{' '}
        <Link to="/sell/fleet/new" className="text-[var(--color-brand)] underline">
          List a whole fleet at once
        </Link>{' '}
        instead — no need to create each listing separately first.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="bundle-title" className="mb-2 block text-sm font-medium">
            Bundle title
          </label>
          <input
            id="bundle-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 2022 fleet clearance — 12 basketball chairs, mixed sizes"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div>
          <label htmlFor="bundle-description" className="mb-2 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="bundle-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Why the fleet's being replaced, general condition, whether it can be viewed as a whole before buying."
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Which listings are in this fleet?
            <span className="ml-1.5 font-normal text-[var(--color-ink-soft)]">
              — pick at least 2
            </span>
          </label>

          {eligible === null ? (
            <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
          ) : eligible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-12 text-center text-[var(--color-ink-soft)]">
              <p>No eligible listings yet — every listing you own is either sold or already in a bundle.</p>
              <Link to="/sell" className="mt-3 inline-block text-[var(--color-brand)] underline">
                List another chair first
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {eligible.map((l) => (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => toggle(l.id)}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-[var(--color-paper-raised)] text-left transition ${
                    selected.has(l.id) ? 'border-[var(--color-brand)]' : 'border-[var(--color-line)]'
                  }`}
                >
                  <div className="relative">
                    <ListingCover sport={l.sport} photos={l.photos} className="h-32 w-full" />
                    {selected.has(l.id) && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-white">
                        <CheckCircle2 size={14} />
                      </span>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-sm">
                      {formatPrice(l.price, l.currency)}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                      {l.category} · {l.condition}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            {selected.size} listing{selected.size === 1 ? '' : 's'} selected · combined asking
            price {formatPrice(total, 'GBP')}
            <span className="ml-1 text-xs">(mixed currencies shown as raw totals, not converted)</span>
          </p>
        )}

        {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting || selected.size < 2}
          className="flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Publish fleet bundle
        </button>
      </form>
    </div>
  );
}
