import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Wand2 } from 'lucide-react';
import { SPORTS, COUNTRIES, type Sport, type Currency } from '@/types';
import { createWantedPost, fetchFitProfile } from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { hasAnyProfileData } from '@/lib/fitMatch';

const CURRENCIES: Currency[] = ['GBP', 'USD', 'EUR', 'AUD', 'CAD'];

const CATEGORY_LABEL: Record<Sport, string> = {
  basketball: 'Sports wheelchair',
  rugby: 'Sports wheelchair',
  racing: 'Racing equipment',
  handcycling: 'Handcycle',
  boccia: 'Boccia equipment',
  swimming: 'Pool equipment',
  tennis: 'Sports wheelchair',
  other: 'Adaptive equipment',
};

export function CreateWanted() {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [canPrefill, setCanPrefill] = useState(false);

  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<Sport>('basketball');
  const [description, setDescription] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [country, setCountry] = useState('United Kingdom');
  const [openToInternational, setOpenToInternational] = useState(false);
  const [seatWidthCm, setSeatWidthCm] = useState('');
  const [seatDepthCm, setSeatDepthCm] = useState('');
  const [minUserHeightCm, setMinUserHeightCm] = useState('');
  const [maxUserHeightCm, setMaxUserHeightCm] = useState('');
  const [minUserWeightKg, setMinUserWeightKg] = useState('');
  const [maxUserWeightKg, setMaxUserWeightKg] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchFitProfile(user.id).then((p) => setCanPrefill(hasAnyProfileData(p)));
  }, [user]);

  function prefillFromProfile() {
    if (!user) return;
    fetchFitProfile(user.id).then((p) => {
      if (p.seatWidthCm) setSeatWidthCm(String(p.seatWidthCm));
      if (p.seatDepthCm) setSeatDepthCm(String(p.seatDepthCm));
      if (p.heightCm) {
        setMinUserHeightCm(String(p.heightCm - 5));
        setMaxUserHeightCm(String(p.heightCm + 5));
      }
      if (p.weightKg) {
        setMinUserWeightKg(String(Math.max(0, p.weightKg - 5)));
        setMaxUserWeightKg(String(p.weightKg + 5));
      }
      if (p.primarySport) setSport(p.primarySport);
    });
  }

  if (submittedId) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <CheckCircle2 className="mx-auto mb-4 text-[var(--color-moss)]" size={40} />
        <h1 className="text-3xl">Wanted post published</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Sellers can now find and message you directly about matching kit.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to={`/wanted/${submittedId}`}
            className="inline-flex rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
          >
            View your post
          </Link>
          <Link
            to="/wanted"
            className="inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
          >
            Back to wanted board
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-3xl">Sign in to post a want</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Wanted posts are tied to your account so sellers can message you back.
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
      <h1 className="text-3xl sm:text-4xl">Post what you're looking for</h1>
      <p className="mt-2 max-w-lg text-[15px] text-[var(--color-ink-soft)]">
        The more specific you are on size, the more useful this is — a vague "looking for a
        basketball chair" is much harder to match than one with real numbers attached.
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitError(null);
          setSubmitting(true);
          try {
            const id = await createWantedPost(user.id, {
              title,
              sport,
              category: CATEGORY_LABEL[sport],
              description,
              maxPrice: maxPrice ? Number(maxPrice) : null,
              currency,
              country,
              openToInternational,
              seatWidthCm: seatWidthCm ? Number(seatWidthCm) : null,
              seatDepthCm: seatDepthCm ? Number(seatDepthCm) : null,
              minUserHeightCm: minUserHeightCm ? Number(minUserHeightCm) : null,
              maxUserHeightCm: maxUserHeightCm ? Number(maxUserHeightCm) : null,
              minUserWeightKg: minUserWeightKg ? Number(minUserWeightKg) : null,
              maxUserWeightKg: maxUserWeightKg ? Number(maxUserWeightKg) : null,
            });
            setSubmittedId(id);
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-8 space-y-8"
      >
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Junior basketball chair, size 3-4"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div>
          <label htmlFor="sport" className="mb-2 block text-sm font-medium">
            Sport
          </label>
          <select
            id="sport"
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport)}
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm sm:w-64"
          >
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium">Fit &amp; sizing you need</label>
            {canPrefill && (
              <button
                type="button"
                onClick={prefillFromProfile}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-brand)] hover:underline"
              >
                <Wand2 size={13} /> Fill from my fit profile
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 sm:grid-cols-3">
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
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Height range min (cm)
              </label>
              <input
                type="number"
                value={minUserHeightCm}
                onChange={(e) => setMinUserHeightCm(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Height range max (cm)
              </label>
              <input
                type="number"
                value={maxUserHeightCm}
                onChange={(e) => setMaxUserHeightCm(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Weight range min (kg)
              </label>
              <input
                type="number"
                value={minUserWeightKg}
                onChange={(e) => setMinUserWeightKg(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                Weight range max (kg)
              </label>
              <input
                type="number"
                value={maxUserWeightKg}
                onChange={(e) => setMaxUserWeightKg(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
            Leave blank whatever's not relevant to this sport.
          </p>
        </div>

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
            placeholder="Condition you'd accept, timeline, anything else a seller should know."
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Budget (optional)</label>
          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2.5 text-sm"
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
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Up to…"
              className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
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
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={openToInternational}
              onChange={(e) => setOpenToInternational(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-line)]"
            />
            Open to a seller shipping from abroad
          </label>
        </div>

        {submitError && <p className="text-sm text-[var(--color-brand-dark)]">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60 sm:w-auto"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Post wanted listing
        </button>
      </form>
    </div>
  );
}
