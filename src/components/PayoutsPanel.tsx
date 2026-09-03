import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, CircleDollarSign, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createConnectOnboardingLink, refreshConnectStatus } from '@/lib/supabaseData';

export function PayoutsPanel() {
  const { profile, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chargesEnabled = !!profile?.stripe_connect_charges_enabled;

  useEffect(() => {
    if (searchParams.get('connect') !== 'return') return;
    setChecking(true);
    refreshConnectStatus()
      .then(() => refreshProfile())
      .catch(() => setError('Could not confirm your payouts status — try refreshing below.'))
      .finally(() => {
        setChecking(false);
        const next = new URLSearchParams(searchParams);
        next.delete('connect');
        setSearchParams(next, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startOnboarding() {
    setError(null);
    setStarting(true);
    try {
      const base = `${window.location.origin}/account?tab=payouts`;
      const url = await createConnectOnboardingLink(`${base}&connect=return`, base);
      window.location.href = url;
    } catch {
      setError("Couldn't start payouts setup — try again in a moment.");
      setStarting(false);
    }
  }

  async function checkStatus() {
    setError(null);
    setChecking(true);
    try {
      await refreshConnectStatus();
      await refreshProfile();
    } catch {
      setError("Couldn't refresh your payouts status.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              chargesEnabled ? 'bg-[var(--color-moss-soft)] text-[var(--color-moss)]' : 'bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]'
            }`}
          >
            {chargesEnabled ? <BadgeCheck size={20} /> : <CircleDollarSign size={20} />}
          </div>
          <div>
            <h2 className="text-lg">{chargesEnabled ? 'Payouts active' : 'Get paid through Relay'}</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {chargesEnabled
                ? 'Buyers can pay you directly through Relay — funds go straight to your bank account.'
                : "Set this up once and buyers can pay you in-app, instead of arranging payment separately."}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-[var(--color-ink-soft)]">
          Payouts are handled by Stripe, not Relay — you'll verify your identity and bank details
          on Stripe's own secure onboarding page. Relay takes a small commission on each sale;
          the rest is transferred to you automatically.
        </p>

        {error && <p className="mt-3 text-sm text-[var(--color-brand-dark)]">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={startOnboarding}
            disabled={starting || checking}
            className="flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
          >
            {starting && <Loader2 size={15} className="animate-spin" />}
            {chargesEnabled ? 'Update payout details' : 'Set up payouts with Stripe'}
          </button>
          <button
            onClick={checkStatus}
            disabled={checking || starting}
            className="flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-60"
          >
            {checking && <Loader2 size={15} className="animate-spin" />}
            Refresh status
          </button>
        </div>

        {!chargesEnabled && (
          <p className="mt-4 text-xs text-[var(--color-ink-soft)]/80">
            Without this, your listings still work as before — buyers can message you and you
            arrange payment yourselves.
          </p>
        )}
      </div>
    </div>
  );
}
