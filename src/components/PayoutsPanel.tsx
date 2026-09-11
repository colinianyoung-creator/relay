import { useEffect, useState } from 'react';
import { loadConnectAndInitialize, type StripeConnectInstance } from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectPayouts,
} from '@stripe/react-connect-js';
import { BadgeCheck, CircleDollarSign, Loader2, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createConnectAccountSession, refreshConnectStatus } from '@/lib/supabaseData';

// Embedded rather than a redirect to a Stripe-hosted page — the seller never
// leaves Relay, and the UI is themed to match via the appearance option
// below, mirroring src/index.css's own tokens.
function getConnectInstance(): StripeConnectInstance {
  return loadConnectAndInitialize({
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string,
    fetchClientSecret: createConnectAccountSession,
    appearance: {
      variables: {
        colorPrimary: '#ff4d2e',
        colorText: '#12131a',
        colorBackground: '#ffffff',
        fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
        borderRadius: '12px',
        buttonPrimaryColorBackground: '#12131a',
        buttonPrimaryColorText: '#ffffff',
      },
    },
  });
}

export function PayoutsPanel() {
  const { profile, refreshProfile } = useAuth();
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [mode, setMode] = useState<'onboarding' | 'payouts' | 'management' | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chargesEnabled = !!profile?.stripe_connect_charges_enabled;

  // A seller with payouts already active goes straight to their balance —
  // that's the thing they actually want to see, not a settings form.
  useEffect(() => {
    if (chargesEnabled && mode === null) {
      setConnectInstance(getConnectInstance());
      setMode('payouts');
    }
  }, [chargesEnabled, mode]);

  function openEmbedded(nextMode: 'onboarding' | 'management') {
    setError(null);
    setConnectInstance(getConnectInstance());
    setMode(nextMode);
  }

  async function handleOnboardingExit() {
    setMode(null);
    setConnectInstance(null);
    setChecking(true);
    try {
      await refreshConnectStatus();
      await refreshProfile();
    } catch {
      setError("Couldn't confirm your payouts status — try refreshing below.");
    } finally {
      setChecking(false);
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
        <div className="flex items-center justify-between gap-3">
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
          {chargesEnabled && mode === 'payouts' && (
            <button
              onClick={() => openEmbedded('management')}
              aria-label="Payout settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              <Settings size={16} />
            </button>
          )}
        </div>

        {!chargesEnabled && (
          <p className="mt-4 text-xs text-[var(--color-ink-soft)]">
            Payouts are handled by Stripe, not Relay — you'll verify your identity and bank details
            right here. Relay takes a small commission on each sale; the rest is transferred to you
            automatically.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-[var(--color-brand-dark)]">{error}</p>}

        {mode && connectInstance ? (
          <div className="mt-5">
            <ConnectComponentsProvider connectInstance={connectInstance}>
              {mode === 'onboarding' ? (
                <ConnectAccountOnboarding onExit={handleOnboardingExit} />
              ) : mode === 'management' ? (
                <ConnectAccountManagement />
              ) : (
                <ConnectPayouts />
              )}
            </ConnectComponentsProvider>
            {mode === 'management' && (
              <button
                onClick={() => setMode('payouts')}
                className="mt-4 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              >
                Back to balance
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => openEmbedded(chargesEnabled ? 'management' : 'onboarding')}
              disabled={checking}
              className="flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {chargesEnabled ? 'Update payout details' : 'Set up payouts with Stripe'}
            </button>
            <button
              onClick={checkStatus}
              disabled={checking}
              className="flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-60"
            >
              {checking && <Loader2 size={15} className="animate-spin" />}
              Refresh status
            </button>
          </div>
        )}

        {!chargesEnabled && !mode && (
          <p className="mt-4 text-xs text-[var(--color-ink-soft)]/80">
            Without this, your listings still work as before — buyers can message you and you
            arrange payment yourselves.
          </p>
        )}
      </div>
    </div>
  );
}
