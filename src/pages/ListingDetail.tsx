import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, MapPin, Star, MessageCircle, Heart, Flag, Globe2, Truck, Loader2, Ruler, CheckCircle2, Search, CreditCard } from 'lucide-react';
import { listings as demoListings } from '@/data/listings';
import {
  fetchListing,
  isSaved,
  toggleSaved,
  hasMessaged,
  sendMessage,
  fetchFitProfile,
  fetchMatchingWantedPosts,
  createPurchaseCheckout,
} from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { isLikelyFit, hasFitSignal, hasAnyProfileData } from '@/lib/fitMatch';
import { ListingPhoto } from '@/components/ListingPhoto';
import { Badge } from '@/components/Badge';
import { AuthModal } from '@/components/AuthModal';
import { ReportListingModal } from '@/components/ReportListingModal';
import { formatPrice, timeAgo } from '@/lib/format';
import type { Listing, FitProfile, WantedPost } from '@/types';

const STRUCTURED_SPEC_LABELS: { key: keyof Listing; label: string; unit: string }[] = [
  { key: 'seatWidthCm', label: 'Seat width', unit: 'cm' },
  { key: 'seatDepthCm', label: 'Seat depth', unit: 'cm' },
  { key: 'weightCapacityKg', label: 'Weight capacity', unit: 'kg' },
  { key: 'minUserHeightCm', label: 'Min. user height', unit: 'cm' },
  { key: 'maxUserHeightCm', label: 'Max. user height', unit: 'cm' },
  { key: 'minUserWeightKg', label: 'Min. user weight', unit: 'kg' },
  { key: 'maxUserWeightKg', label: 'Max. user weight', unit: 'kg' },
];

export function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [messageSent, setMessageSent] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [fitProfile, setFitProfile] = useState<FitProfile | null>(null);
  const [matches, setMatches] = useState<WantedPost[] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!id) return;
    const demo = demoListings.find((l) => l.id === id);
    if (demo) {
      setListing(demo);
      return;
    }
    fetchListing(id)
      .then((l) => setListing(l))
      .catch(() => setListing(null));
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    isSaved(user.id, id).then(setSaved);
    hasMessaged(id, user.id).then(setMessageSent);
    fetchFitProfile(user.id).then(setFitProfile);
  }, [id, user]);

  useEffect(() => {
    if (!listing || !user || user.id !== listing.seller.id) return;
    if (demoListings.some((l) => l.id === listing.id)) return;
    if (listing.feeStatus === 'pending') return;
    fetchMatchingWantedPosts(listing).then(setMatches);
  }, [listing, user]);

  if (listing === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-[var(--color-ink-soft)]">Listing not found.</p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to browse
        </Link>
      </div>
    );
  }

  const isDemo = demoListings.some((l) => l.id === listing.id);
  const structuredSpecs = STRUCTURED_SPEC_LABELS.filter(
    ({ key }) => typeof listing[key] === 'number',
  );
  const fitProfileUsable = hasAnyProfileData(fitProfile);
  const fitSignal = fitProfileUsable && hasFitSignal(listing, fitProfile);
  const fits = fitSignal && isLikelyFit(listing, fitProfile);
  const isSold = !!listing.soldAt;
  const canBuyInApp =
    !isDemo && !isSold && listing.price !== null && listing.seller.payoutsEnabled && user?.id !== listing.seller.id;

  async function handleBuyNow() {
    setBuyError(null);
    setBuying(true);
    try {
      const origin = window.location.origin;
      const url = await createPurchaseCheckout(
        listing!.id,
        `${origin}/purchase/confirm?listing_id=${listing!.id}`,
        `${origin}/listing/${listing!.id}`,
      );
      window.location.href = url;
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Something went wrong starting checkout.');
      setBuying(false);
    }
  }

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
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={15} /> Back to browse
      </Link>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {listing.photos && listing.photos.length > 0 ? (
            <>
              <img
                src={listing.photos[photoIndex]}
                alt={listing.title}
                className="h-80 w-full rounded-2xl object-cover sm:h-[26rem]"
              />
              {listing.photos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {listing.photos.map((photo, i) => (
                    <button
                      key={photo}
                      onClick={() => setPhotoIndex(i)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                        i === photoIndex ? 'border-[var(--color-brand)]' : 'border-transparent'
                      }`}
                    >
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <ListingPhoto sport={listing.sport} className="h-80 w-full rounded-2xl sm:h-[26rem]" />
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>{listing.category}</Badge>
            <Badge tone="moss">{listing.condition}</Badge>
            {listing.price === null && <Badge tone="brand">Free to a good home</Badge>}
            {isSold && <Badge tone="brand">Sold</Badge>}
          </div>

          <h1 className="mt-4 text-3xl leading-tight sm:text-4xl">{listing.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--color-ink-soft)]">
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {listing.location}, {listing.country}
            </span>
            <span>·</span>
            <span>Listed {timeAgo(listing.postedAt)}</span>
            {listing.shipsInternationally && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-[var(--color-moss)]">
                  <Globe2 size={14} /> Ships internationally
                </span>
              </>
            )}
          </div>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink)]">
            {listing.description}
          </p>

          {structuredSpecs.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg">
                <Ruler size={17} /> Fit &amp; sizing
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 sm:grid-cols-3">
                {structuredSpecs.map(({ key, label, unit }) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {listing[key] as number}
                      {unit}
                    </dd>
                  </div>
                ))}
              </dl>

              {fitSignal && (
                <div
                  className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-sm ${
                    fits
                      ? 'bg-[var(--color-moss-soft)] text-[var(--color-moss)]'
                      : 'bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]'
                  }`}
                >
                  <CheckCircle2 size={15} />
                  {fits
                    ? 'Checked against your fit profile (with a few cm/kg of leeway) — looks like a plausible fit.'
                    : "Checked against your fit profile — even allowing some leeway, this doesn't look like a match on the numbers you've saved."}
                </div>
              )}
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-3 text-lg">Specifications</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 sm:grid-cols-3">
              {listing.measurements.map((m) => (
                <div key={m.label}>
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    {m.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium">{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {listing.shipsInternationally && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 text-sm text-[var(--color-ink-soft)]">
              <Truck size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />
              <span>
                This seller ships internationally. Specialist freight for equipment like this
                typically runs $300–500 depending on distance and packaging — worth agreeing
                who covers it before you commit to buy.
              </span>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl">
                {formatPrice(listing.price, listing.currency)}
              </span>
              <button
                onClick={() =>
                  requireAuth(async () => {
                    if (isDemo) {
                      setSaved((v) => !v);
                      return;
                    }
                    const next = await toggleSaved(user!.id, listing.id);
                    setSaved(next);
                  })
                }
                aria-label="Save listing"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                <Heart size={16} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-[var(--color-brand)]' : ''} />
              </button>
            </div>

            <Link
              to={`/seller/${listing.seller.id}`}
              className="mt-5 flex items-center gap-3 border-t border-[var(--color-line)] pt-5 hover:opacity-80"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-soft)] font-display text-[var(--color-brand-dark)]">
                {listing.seller.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-medium">
                  {listing.seller.name}
                  {listing.seller.verified && (
                    <BadgeCheck size={14} className="text-[var(--color-moss)]" />
                  )}
                </div>
                <div className="truncate text-xs text-[var(--color-ink-soft)]">
                  {listing.seller.club ?? `Member since ${listing.seller.memberSince}`}
                </div>
              </div>
            </Link>

            <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-ink-soft)]">
              <span className="flex items-center gap-1">
                <Star size={12} className="fill-[var(--color-brand)] text-[var(--color-brand)]" />
                {listing.seller.rating.toFixed(1)}
              </span>
              <span>
                {listing.seller.salesCount} completed sale{listing.seller.salesCount === 1 ? '' : 's'}
              </span>
            </div>

            {user?.id === listing.seller.id ? (
              <div className="mt-5">
                {listing.feeStatus === 'pending' ? (
                  <p className="rounded-xl bg-[var(--color-brand-soft)] p-4 text-sm text-[var(--color-brand-dark)]">
                    Payment pending — this listing is only visible to you until checkout
                    completes. Refresh in a moment if you've already paid.
                  </p>
                ) : (
                  <p className="rounded-xl bg-[var(--color-line)]/40 p-4 text-sm text-[var(--color-ink-soft)]">
                    This is your own listing.
                  </p>
                )}

                {matches === null ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                    <Loader2 size={12} className="animate-spin" /> Checking the wanted board…
                  </p>
                ) : matches.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-dark)]">
                      <Search size={14} /> {matches.length} buyer{matches.length === 1 ? '' : 's'}{' '}
                      on the wanted board might want this
                    </p>
                    <div className="space-y-2">
                      {matches.map((m) => (
                        <Link
                          key={m.id}
                          to={`/wanted/${m.id}`}
                          className="block rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm hover:border-[var(--color-brand)]"
                        >
                          <span className="font-medium">{m.title}</span>
                          <span className="ml-2 text-xs text-[var(--color-ink-soft)]">
                            {m.maxPrice ? `up to ${formatPrice(m.maxPrice, m.currency)}` : 'any budget'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                    No matching wants on the board right now.
                  </p>
                )}
              </div>
            ) : isSold ? (
              <div className="mt-5 rounded-xl bg-[var(--color-line)]/40 p-4 text-sm text-[var(--color-ink-soft)]">
                This listing has sold.
              </div>
            ) : messageSent ? (
              <div className="mt-5 rounded-xl bg-[var(--color-moss-soft)] p-4 text-sm text-[var(--color-moss)]">
                Message sent — {listing.seller.name.split(' ')[0]} typically replies within a day.
                Arrange payment and collection directly with them.
              </div>
            ) : (
              <div className="mt-5">
                {canBuyInApp && (
                  <>
                    <button
                      onClick={() => requireAuth(handleBuyNow)}
                      disabled={buying}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
                    >
                      {buying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      Buy now — pay securely
                    </button>
                    {buyError && <p className="mt-2 text-xs text-[var(--color-brand-dark)]">{buyError}</p>}
                    <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-ink-soft)]">
                      <span className="h-px flex-1 bg-[var(--color-line)]" /> or
                      <span className="h-px flex-1 bg-[var(--color-line)]" />
                    </div>
                  </>
                )}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hi ${listing.seller.name.split(' ')[0]}, is this still available? I'd love to know more about...`}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
                <button
                  onClick={() =>
                    requireAuth(async () => {
                      if (isDemo) {
                        setMessageSent(true);
                        return;
                      }
                      await sendMessage(listing.id, user!.id, message);
                      setMessageSent(true);
                    })
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
                >
                  <MessageCircle size={16} /> Message seller
                </button>
              </div>
            )}

            {isDemo && (
              <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)]/70">
                Demo listing — saves and messages here aren't stored.
              </p>
            )}

            {!isSold && user?.id !== listing.seller.id && (
              <p className="mt-4 text-center text-xs text-[var(--color-ink-soft)]">
                {canBuyInApp
                  ? 'Pay securely in-app via Stripe — Relay never sees your card details.'
                  : "This seller hasn't set up in-app payouts — buyers and sellers arrange payment directly."}
              </p>
            )}
          </div>

          <button
            onClick={() => requireAuth(() => setShowReport(true))}
            disabled={isDemo}
            title={isDemo ? "Demo listing — there's nothing real to report here." : undefined}
            className="mt-4 flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Flag size={12} /> Report this listing
          </button>
        </aside>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showReport && user && (
        <ReportListingModal
          listingId={listing.id}
          listingTitle={listing.title}
          reporterId={user.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
