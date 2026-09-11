import { useState } from 'react';
import { Truck, MapPin, Users } from 'lucide-react';
import { COUNTRIES } from '@/types';
import { loadMyArea, saveMyArea, skipMyArea, suggestDelivery, type MyArea } from '@/lib/delivery';

const boxClass =
  'mt-5 flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 text-sm text-[var(--color-ink-soft)]';

/**
 * Nudges a buyer toward local collection when they and the seller look to be
 * nearby, otherwise points at long-distance shipping — see src/lib/delivery.ts
 * for why this is a coarse same-town/same-country heuristic rather than a
 * real distance calculation.
 */
export function DeliverySuggestion({
  listing,
  sellerFirstName,
  sellerClub,
  buyerClub,
  shipsInternationally,
}: {
  listing: { country: string; location: string };
  sellerFirstName: string;
  sellerClub?: string | null;
  buyerClub?: string | null;
  shipsInternationally: boolean;
}) {
  const [myArea, setMyArea] = useState<MyArea | null>(() => loadMyArea());
  const [country, setCountry] = useState('');
  const [town, setTown] = useState('');

  if (myArea === null) {
    return (
      <div className={boxClass}>
        <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />
        <div className="flex-1">
          <p className="mb-2">Roughly where are you? Helps suggest collection vs shipping.</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
            >
              <option value="">Country…</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="Town or city (optional)"
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-ink-soft)]"
            />
            <button
              onClick={() => {
                if (!country) return;
                const area = { country, town: town.trim() };
                saveMyArea(area);
                setMyArea(area);
              }}
              disabled={!country}
              className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => {
                skipMyArea();
                setMyArea(loadMyArea());
              }}
              className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  const suggestion = suggestDelivery(myArea, listing);
  const bothInClub = Boolean(sellerClub && buyerClub);

  if (suggestion === 'same-town') {
    return (
      <div className={boxClass}>
        <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--color-moss)]" />
        <span>
          You're both in {listing.location} — local collection could save the shipping cost
          entirely. Message {sellerFirstName} to arrange a pickup.
        </span>
      </div>
    );
  }

  if (suggestion === 'same-country') {
    return (
      <div className={boxClass}>
        {bothInClub ? <Users size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" /> : <MapPin size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />}
        <span>
          You're both in the {listing.country} — worth asking about local collection or a
          meet-halfway drop-off before paying for shipping.
          {bothInClub &&
            ` You're both connected to a club (${buyerClub} / ${sellerClub}) — some clubs arrange kit drop-offs at away fixtures or regional meets too.`}
        </span>
      </div>
    );
  }

  if (!shipsInternationally) return null;

  return (
    <div className={boxClass}>
      <Truck size={18} className="mt-0.5 shrink-0 text-[var(--color-ink-soft)]" />
      <span>
        This seller ships internationally. Specialist freight for equipment like this typically
        runs $300–500 depending on distance and packaging — worth agreeing who covers it before
        you commit to buy. Once purchased, you can request a shipping quote from your Orders tab.
      </span>
    </div>
  );
}
