import { useState } from 'react';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { Loader2, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { refreshConnectStatus } from '@/lib/supabaseData';
import { getConnectInstance } from '@/lib/stripeConnect';

// Shown in place of a listing form when the seller tries to publish a paid
// listing without payouts set up. Embedded rather than a redirect to
// /account so the form's own state (still just React state in the caller)
// survives the round trip untouched.
export function PayoutsGate({
  onDone,
}: {
  onDone: (chargesEnabled: boolean) => void;
}) {
  const { refreshProfile } = useAuth();
  const [connectInstance] = useState(() => getConnectInstance());
  const [checking, setChecking] = useState(false);

  async function handleExit() {
    setChecking(true);
    let enabled = false;
    try {
      enabled = await refreshConnectStatus();
      await refreshProfile();
    } finally {
      setChecking(false);
      onDone(enabled);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="text-lg">Set up payouts to publish this listing</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Relay needs your bank details on file so a buyer can actually pay
              you — you'll verify your identity and bank details right here.
            </p>
          </div>
        </div>

        <div className="mt-5">
          {checking && (
            <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
              <Loader2 size={15} className="animate-spin" /> Checking your
              payouts status…
            </div>
          )}
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding onExit={handleExit} />
          </ConnectComponentsProvider>
        </div>

        <button
          onClick={() => onDone(false)}
          className="mt-4 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          Not ready — go back
        </button>
      </div>
    </div>
  );
}
