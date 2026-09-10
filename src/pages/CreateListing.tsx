import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImagePlus, CheckCircle2, Loader2, X } from 'lucide-react';
import { SPORTS, CONDITIONS, COUNTRIES, type Sport, type Condition, type Currency } from '@/types';
import { ListingPhoto } from '@/components/ListingPhoto';
import {
  createListing,
  createListingCheckout,
  deletePendingListing,
  fetchListing,
  uploadListingPhoto,
  LISTING_FEE_GBP,
} from '@/lib/supabaseData';
import {
  CURRENCIES,
  MEASUREMENT_FIELDS,
  CATEGORY_LABEL,
  SHOWS_SEAT_FIELDS,
  SHOWS_WEIGHT_CAPACITY,
  SHOWS_USER_RANGE,
} from '@/lib/listingFields';
import { useAuth } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';

export function CreateListing() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutCancelled, setCheckoutCancelled] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport>('basketball');
  const [condition, setCondition] = useState<Condition>('good');
  const [isFree, setIsFree] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState<string>('United Kingdom');
  const [shipsInternationally, setShipsInternationally] = useState(false);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [seatWidthCm, setSeatWidthCm] = useState('');
  const [seatDepthCm, setSeatDepthCm] = useState('');
  const [weightCapacityKg, setWeightCapacityKg] = useState('');
  const [minUserHeightCm, setMinUserHeightCm] = useState('');
  const [maxUserHeightCm, setMaxUserHeightCm] = useState('');
  const [minUserWeightKg, setMinUserWeightKg] = useState('');
  const [maxUserWeightKg, setMaxUserWeightKg] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 6;

  useEffect(() => {
    const cancelledId = searchParams.get('cancelled');
    if (!cancelledId) return;
    deletePendingListing(cancelledId).finally(() => {
      setCheckoutCancelled(true);
      setSearchParams((prev) => {
        prev.delete('cancelled');
        return prev;
      });
    });
  }, [searchParams, setSearchParams]);

  // Pre-fills everything except title/price/photos from an existing listing
  // — the "list 12 similar chairs" case is much faster as duplicate-and-tweak
  // than 12 blank forms.
  useEffect(() => {
    const duplicateId = searchParams.get('duplicate');
    if (!duplicateId) return;
    fetchListing(duplicateId).then((source) => {
      if (!source) return;
      setSport(source.sport);
      setCondition(source.condition);
      setDescription(source.description);
      setCurrency(source.currency);
      setLocation(source.location);
      setCountry(source.country);
      setShipsInternationally(source.shipsInternationally);
      setMeasurementValues(Object.fromEntries(source.measurements.map((m) => [m.label, m.value])));
      setSeatWidthCm(source.seatWidthCm?.toString() ?? '');
      setSeatDepthCm(source.seatDepthCm?.toString() ?? '');
      setWeightCapacityKg(source.weightCapacityKg?.toString() ?? '');
      setMinUserHeightCm(source.minUserHeightCm?.toString() ?? '');
      setMaxUserHeightCm(source.maxUserHeightCm?.toString() ?? '');
      setMinUserWeightKg(source.minUserWeightKg?.toString() ?? '');
      setMaxUserWeightKg(source.maxUserWeightKg?.toString() ?? '');
      setSearchParams((prev) => {
        prev.delete('duplicate');
        return prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPhotoFiles(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const incoming = Array.from(files);
    const room = MAX_PHOTOS - photoFiles.length;
    if (incoming.length > room) {
      setPhotoError(`Up to ${MAX_PHOTOS} photos — added the first ${room}.`);
    }
    const accepted = incoming.slice(0, room).filter((f) => f.type.startsWith('image/'));
    setPhotoFiles((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  if (submittedId) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <CheckCircle2 className="mx-auto mb-4 text-[var(--color-moss)]" size={40} />
        <h1 className="text-3xl">Listing published</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Your listing is now live on Relay. We'll email you when someone gets in touch.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to={`/listing/${submittedId}`}
            className="inline-flex rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
          >
            View your listing
          </Link>
          <Link
            to="/"
            className="inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
          >
            Back to browse
          </Link>
        </div>

      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-3xl">Sign in to list equipment</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Listings are tied to your account so buyers can message you and see your other kit.
        </p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-6 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
        >
          Sign in or create an account
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl sm:text-4xl">List a piece of equipment</h1>
      <p className="mt-2 max-w-lg text-[15px] text-[var(--color-ink-soft)]">
        Give it good measurements and honest photos — that's what gets a fast, well-matched
        buyer, not a lower price.
      </p>

      {checkoutCancelled && (
        <p className="mt-4 rounded-xl bg-[var(--color-line)]/40 p-3 text-sm text-[var(--color-ink-soft)]">
          Checkout cancelled — nothing was published or charged. Fill in the form again whenever
          you're ready.
        </p>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitError(null);
          setSubmitting(true);
          try {
            const photoUrls: string[] = [];
            for (const file of photoFiles) {
              photoUrls.push(await uploadListingPhoto(user.id, file));
            }
            const id = await createListing(user.id, {
              photos: photoUrls,
              title,
              sport,
              category: CATEGORY_LABEL[sport],
              condition,
              price: isFree ? null : Number(price) || 0,
              currency,
              description,
              measurements: MEASUREMENT_FIELDS[sport]
                .map((label) => ({ label, value: measurementValues[label] ?? '' }))
                .filter((m) => m.value.trim() !== ''),
              location,
              country,
              shipsInternationally,
              seatWidthCm: seatWidthCm ? Number(seatWidthCm) : null,
              seatDepthCm: seatDepthCm ? Number(seatDepthCm) : null,
              weightCapacityKg: weightCapacityKg ? Number(weightCapacityKg) : null,
              minUserHeightCm: minUserHeightCm ? Number(minUserHeightCm) : null,
              maxUserHeightCm: maxUserHeightCm ? Number(maxUserHeightCm) : null,
              minUserWeightKg: minUserWeightKg ? Number(minUserWeightKg) : null,
              maxUserWeightKg: maxUserWeightKg ? Number(maxUserWeightKg) : null,
            });

            if (isFree) {
              setSubmittedId(id);
              setSubmitting(false);
              return;
            }

            // Paid listing: hand off to Stripe. The listing already exists
            // (status 'pending', invisible to everyone but us) so if the
            // buyer abandons checkout, /sell's cancelled-listing handling
            // cleans it up rather than leaving an orphaned draft.
            const origin = window.location.origin;
            const url = await createListingCheckout(
              id,
              `${origin}/sell/confirm?listing_id=${id}`,
              `${origin}/sell?cancelled=${id}`,
            );
            window.location.href = url;
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
            setSubmitting(false);
          }
        }}
        className="mt-8 space-y-8"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">
            Photos
            <span className="ml-1.5 font-normal text-[var(--color-ink-soft)]">
              — optional, but real photos get real interest
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            {photoPreviews.map((src, i) => (
              <div key={src} className="group relative h-28 w-28 shrink-0">
                <img
                  src={src}
                  alt=""
                  className="h-full w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label="Remove photo"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-ink)] text-white shadow-sm hover:bg-black"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {photoPreviews.length === 0 && (
              <ListingPhoto sport={sport} className="h-28 w-28 shrink-0 rounded-xl opacity-60" />
            )}

            {photoFiles.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-soft)]"
              >
                <ImagePlus size={20} />
                <span className="text-xs">Add photo</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addPhotoFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
          {photoError && (
            <p className="mt-2 text-xs text-[var(--color-brand-dark)]">{photoError}</p>
          )}
          {photoPreviews.length === 0 && (
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              No photos yet — we'll show a placeholder for your sport instead.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Melrose RX3 Basketball Chair — size 5"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="sport" className="mb-2 block text-sm font-medium">
              Sport
            </label>
            <select
              id="sport"
              value={sport}
              onChange={(e) => {
                setSport(e.target.value as Sport);
                setMeasurementValues({});
              }}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm"
            >
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="condition" className="mb-2 block text-sm font-medium">
              Condition
            </label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm"
            >
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Measurements &amp; specs
          </label>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            {MEASUREMENT_FIELDS[sport].map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                  {field}
                </label>
                <input
                  value={measurementValues[field] ?? ''}
                  onChange={(e) =>
                    setMeasurementValues((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
              </div>
            ))}
          </div>
        </div>

        {(SHOWS_SEAT_FIELDS.includes(sport) ||
          SHOWS_WEIGHT_CAPACITY.includes(sport) ||
          SHOWS_USER_RANGE.includes(sport)) && (
          <div>
            <label className="mb-2 block text-sm font-medium">
              Fit &amp; sizing
              <span className="ml-1.5 font-normal text-[var(--color-ink-soft)]">
                — used to match this listing against a buyer's fit profile
              </span>
            </label>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 sm:grid-cols-4">
              {SHOWS_SEAT_FIELDS.includes(sport) && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Seat width (cm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={seatWidthCm}
                      onChange={(e) => setSeatWidthCm(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Seat depth (cm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={seatDepthCm}
                      onChange={(e) => setSeatDepthCm(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                </>
              )}
              {SHOWS_WEIGHT_CAPACITY.includes(sport) && (
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                    Weight capacity (kg)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={weightCapacityKg}
                    onChange={(e) => setWeightCapacityKg(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </div>
              )}
              {SHOWS_USER_RANGE.includes(sport) && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Min. user height (cm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={minUserHeightCm}
                      onChange={(e) => setMinUserHeightCm(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Max. user height (cm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={maxUserHeightCm}
                      onChange={(e) => setMaxUserHeightCm(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Min. user weight (kg)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={minUserWeightKg}
                      onChange={(e) => setMinUserWeightKg(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Max. user weight (kg)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={maxUserWeightKg}
                      onChange={(e) => setMaxUserWeightKg(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              Leave anything blank you're not sure of — it just won't be used for matching.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Why you're selling, how it's been used, anything a buyer should know before travelling to view it."
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Price</label>
          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              disabled={isFree}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2.5 text-sm disabled:opacity-40"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              required={!isFree}
              disabled={isFree}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)] disabled:opacity-40"
            />
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-[var(--color-ink-soft)]">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-line)]"
              />
              Free / donation
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
            {isFree
              ? "Free and donation listings don't pay a posting fee."
              : `A flat £${LISTING_FEE_GBP} posting fee applies at checkout, whatever this listing's price or currency.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="location" className="mb-2 block text-sm font-medium">
              Town or city
            </label>
            <input
              id="location"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Exact address is never shown publicly"
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
          <div>
            <label htmlFor="country" className="mb-2 block text-sm font-medium">
              Country
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          <input
            type="checkbox"
            checked={shipsInternationally}
            onChange={(e) => setShipsInternationally(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-line)]"
          />
          I'm willing to ship this internationally (buyer usually covers freight)
        </label>

        {submitError && <p className="text-sm text-[var(--color-brand-dark)]">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 sm:w-auto"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          {isFree ? 'Publish listing' : `Continue to payment (£${LISTING_FEE_GBP})`}
        </button>
      </form>
    </div>
  );
}
