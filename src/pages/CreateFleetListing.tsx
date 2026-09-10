import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { SPORTS, CONDITIONS, COUNTRIES, type Sport, type Condition } from '@/types';
import { ListingPhoto } from '@/components/ListingPhoto';
import {
  createFleetListing,
  uploadListingPhoto,
  type FleetItemInput,
} from '@/lib/supabaseData';
import { CURRENCIES, CATEGORY_LABEL, SHOWS_SEAT_FIELDS } from '@/lib/listingFields';
import { useAuth } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { formatPrice } from '@/lib/format';
import type { Currency } from '@/types';

interface ItemDraft {
  key: string;
  title: string;
  condition: Condition;
  price: string;
  sellableIndividually: boolean;
  seatWidthCm: string;
  seatDepthCm: string;
}

function newItem(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    title: '',
    condition: 'good',
    price: '',
    sellableIndividually: true,
    seatWidthCm: '',
    seatDepthCm: '',
  };
}

export function CreateFleetListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState<Sport>('basketball');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState<string>('United Kingdom');
  const [shipsInternationally, setShipsInternationally] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<ItemDraft[]>([newItem(), newItem()]);

  const MAX_PHOTOS = 6;
  const showsSeatFields = SHOWS_SEAT_FIELDS.includes(sport);

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

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 2 ? prev : prev.filter((it) => it.key !== key)));
  }

  const total = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-3xl">Sign in to list club gear</h1>
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
      <div className="flex items-center gap-2">
        <Boxes size={22} className="text-[var(--color-brand)]" />
        <h1 className="text-2xl sm:text-3xl">List your club's gear</h1>
      </div>
      <p className="mt-2 max-w-lg text-[15px] text-[var(--color-ink-soft)]">
        Group details once — sport, location, photos — then give each item its own title,
        condition, price and sizing. No listing fee for club gear lots — Relay only takes its
        commission once something actually sells.
      </p>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        Already listed these separately?{' '}
        <Link to="/sell/fleet/existing" className="text-[var(--color-brand)] underline">
          Group existing listings instead
        </Link>
        .
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitError(null);

          if (items.length < 2) {
            setSubmitError('A gear lot needs at least 2 items.');
            return;
          }
          for (const it of items) {
            if (!it.title.trim() || !(Number(it.price) > 0)) {
              setSubmitError('Every item needs a title and a price greater than 0.');
              return;
            }
          }

          setSubmitting(true);
          try {
            const photoUrls: string[] = [];
            for (const file of photoFiles) {
              photoUrls.push(await uploadListingPhoto(user.id, file));
            }

            const itemInputs: FleetItemInput[] = items.map((it) => ({
              title: it.title,
              condition: it.condition,
              price: Number(it.price),
              sellableIndividually: it.sellableIndividually,
              seatWidthCm: it.seatWidthCm ? Number(it.seatWidthCm) : null,
              seatDepthCm: it.seatDepthCm ? Number(it.seatDepthCm) : null,
            }));

            const bundleId = await createFleetListing(
              user.id,
              {
                title,
                description,
                sport,
                category: CATEGORY_LABEL[sport],
                currency,
                location,
                country,
                shipsInternationally,
                photos: photoUrls,
              },
              itemInputs,
            );

            navigate(`/fleet/${bundleId}`);
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
              — optional, shown across every item in this lot
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            {photoPreviews.map((src, i) => (
              <div key={src} className="group relative h-28 w-28 shrink-0">
                <img src={src} alt="" className="h-full w-full rounded-xl object-cover" />
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
          {photoError && <p className="mt-2 text-xs text-[var(--color-brand-dark)]">{photoError}</p>}
        </div>

        <div>
          <label htmlFor="fleet-title" className="mb-2 block text-sm font-medium">
            Gear lot title
          </label>
          <input
            id="fleet-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 2022 gear clearance — 12 basketball chairs, mixed sizes"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div>
          <label htmlFor="fleet-description" className="mb-2 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="fleet-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Why the gear's being replaced, general condition, whether it can be viewed as a whole before buying."
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="fleet-sport" className="mb-2 block text-sm font-medium">
              Sport
            </label>
            <select
              id="fleet-sport"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
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
            <label htmlFor="fleet-currency" className="mb-2 block text-sm font-medium">
              Currency
            </label>
            <select
              id="fleet-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="fleet-location" className="mb-2 block text-sm font-medium">
              Town or city
            </label>
            <input
              id="fleet-location"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Exact address is never shown publicly"
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
          <div>
            <label htmlFor="fleet-country" className="mb-2 block text-sm font-medium">
              Country
            </label>
            <select
              id="fleet-country"
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

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium">
              Items in this lot
              <span className="ml-1.5 font-normal text-[var(--color-ink-soft)]">
                — at least 2
              </span>
            </label>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, newItem()])}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              <Plus size={13} /> Add another item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={it.key} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-ink-soft)]">Item {i + 1}</span>
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeItem(it.key)}
                      aria-label={`Remove item ${i + 1}`}
                      className="text-[var(--color-ink-soft)] hover:text-[var(--color-brand-dark)]"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    value={it.title}
                    onChange={(e) => updateItem(it.key, { title: e.target.value })}
                    placeholder="e.g. Melrose RX3 Basketball Chair — size 5"
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)] sm:col-span-2"
                  />
                  <select
                    value={it.condition}
                    onChange={(e) => updateItem(it.key, { condition: e.target.value as Condition })}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    required
                    value={it.price}
                    onChange={(e) => updateItem(it.key, { price: e.target.value })}
                    placeholder={`Price (${currency})`}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                  />
                  {showsSeatFields && (
                    <>
                      <input
                        type="number"
                        step="0.5"
                        value={it.seatWidthCm}
                        onChange={(e) => updateItem(it.key, { seatWidthCm: e.target.value })}
                        placeholder="Seat width (cm)"
                        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={it.seatDepthCm}
                        onChange={(e) => updateItem(it.key, { seatDepthCm: e.target.value })}
                        placeholder="Seat depth (cm)"
                        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                      />
                    </>
                  )}
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                  <input
                    type="checkbox"
                    checked={it.sellableIndividually}
                    onChange={(e) => updateItem(it.key, { sellableIndividually: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-[var(--color-line)]"
                  />
                  Also sell this separately
                  <span className="text-[var(--color-ink-soft)]/70">
                    — off means it's only buyable as part of this lot
                  </span>
                </label>
              </div>
            ))}
          </div>

          {total > 0 && (
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
              {items.length} items · combined asking price {formatPrice(total, currency)}
            </p>
          )}
        </div>

        {submitError && <p className="text-sm text-[var(--color-brand-dark)]">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 sm:w-auto"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Publish gear lot
        </button>
      </form>
    </div>
  );
}
