import { Link } from 'react-router-dom';
import { BellPlus, Check, Loader2 } from 'lucide-react';
import { SPORTS, type Sport } from '@/types';

interface NotifyMeProps {
  /** Show a sport picker; hide it when the person has already set filters. */
  showSport: boolean;
  sport: Sport | 'all';
  onSportChange: (sport: Sport | 'all') => void;
  onNotify: () => void;
  saving: boolean;
  done: boolean;
  signedIn: boolean;
  /** Heading above the controls. */
  heading: string;
}

/** "Email me when kit like this is listed" — creates a saved search under the hood. */
export function NotifyMe({
  showSport,
  sport,
  onSportChange,
  onNotify,
  saving,
  done,
  signedIn,
  heading,
}: NotifyMeProps) {
  if (done) {
    return (
      <div role="status" className="mx-auto mt-6 flex max-w-md items-start gap-2.5 text-left text-sm text-[var(--color-moss-dark)]">
        <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <p>
          You're on the list. We'll email you when matching kit is listed. You can change or stop
          this any time in{' '}
          <Link to="/account" className="underline hover:text-[var(--color-ink)]">
            your account
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-md">
      <p className="text-sm font-medium">{heading}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {showSport && (
          <>
            <label htmlFor="notify-sport" className="sr-only">
              Sport to be notified about
            </label>
            <select
              id="notify-sport"
              value={sport}
              onChange={(e) => onSportChange(e.target.value as Sport | 'all')}
              className="flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 text-sm"
            >
              <option value="all">Any sport</option>
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          onClick={onNotify}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-brand-dark)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-darker)] disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <BellPlus size={15} aria-hidden="true" />}
          Notify me
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        {signedIn
          ? "We'll email you when matching kit is listed."
          : "You'll need a free account so we know where to email you."}
      </p>
    </div>
  );
}
