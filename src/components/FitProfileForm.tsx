import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Ruler } from 'lucide-react';
import { SPORTS, type Sport, type FitProfile } from '@/types';
import { fetchFitProfile, saveFitProfile } from '@/lib/supabaseData';

const EMPTY: FitProfile = {
  primarySport: null,
  disabilityNotes: '',
  classification: '',
  heightCm: null,
  weightKg: null,
  seatWidthCm: null,
  seatDepthCm: null,
  inseamCm: null,
  notes: '',
};

function numOrNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v);
}

export function FitProfileForm({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<FitProfile>(EMPTY);

  useEffect(() => {
    fetchFitProfile(userId)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 text-sm text-[var(--color-ink-soft)]">
        <Ruler size={18} className="mt-0.5 shrink-0" />
        <span>
          Fill in what's relevant to you — everything's optional. This is only used to show a
          "likely fits you" flag on listings and let you filter to your size, matched with a bit
          of leeway rather than an exact match. It's never shown publicly on your profile.
        </span>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setSaved(false);
          await saveFitProfile(userId, profile);
          setSaving(false);
          setSaved(true);
        }}
        className="space-y-6"
      >
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Primary sport</label>
            <select
              value={profile.primarySport ?? ''}
              onChange={(e) =>
                setProfile((p) => ({ ...p, primarySport: (e.target.value || null) as Sport | null }))
              }
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm"
            >
              <option value="">Not set</option>
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Classification</label>
            <input
              value={profile.classification}
              onChange={(e) => setProfile((p) => ({ ...p, classification: e.target.value }))}
              placeholder="e.g. T54, 3.5 point, BC2"
              className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Impairment / access notes</label>
          <textarea
            value={profile.disabilityNotes}
            onChange={(e) => setProfile((p) => ({ ...p, disabilityNotes: e.target.value }))}
            rows={2}
            placeholder="e.g. bilateral transfemoral amputee, T10 spinal cord injury — whatever's relevant to sizing"
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">
              Height (cm)
            </label>
            <input
              type="number"
              value={profile.heightCm ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, heightCm: numOrNull(e.target.value) }))}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">
              Weight (kg)
            </label>
            <input
              type="number"
              value={profile.weightKg ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, weightKg: numOrNull(e.target.value) }))}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">
              Seat width (cm)
            </label>
            <input
              type="number"
              value={profile.seatWidthCm ?? ''}
              onChange={(e) =>
                setProfile((p) => ({ ...p, seatWidthCm: numOrNull(e.target.value) }))
              }
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-ink-soft)]">
              Seat depth (cm)
            </label>
            <input
              type="number"
              value={profile.seatDepthCm ?? ''}
              onChange={(e) =>
                setProfile((p) => ({ ...p, seatDepthCm: numOrNull(e.target.value) }))
              }
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Anything else worth knowing</label>
          <textarea
            value={profile.notes}
            onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            placeholder="Growth expected, preferred camber, existing equipment, whatever helps a seller understand your fit."
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save fit profile
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-moss)]">
              <CheckCircle2 size={15} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
