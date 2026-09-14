import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadConnectAndInitialize, type StripeConnectInstance } from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectPayouts,
} from '@stripe/react-connect-js';
import { BadgeCheck, CircleDollarSign, Loader2, Settings, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createConnectAccountSession, refreshConnectStatus, type MyOrder } from '@/lib/supabaseData';
import { ListingRefRow } from '@/components/ListingRefRow';
import { Badge } from '@/components/Badge';
import { formatPrice, timeAgo } from '@/lib/format';

function transferTone(status: MyOrder['transferStatus']): 'brand' | 'moss' | 'neutral' {
  if (status === 'released') return 'moss';
  if (status === 'pending') return 'brand';
  return 'neutral';
}

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

export function PayoutsPanel({ orders }: { orders: MyOrder[] | null }) {
  const { profile, refreshProfile } = useAuth();
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [mode, setMode] = useState<'onboarding' | 'payouts' | 'management' | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chargesEnabled = !!profile?.stripe_connect_charges_enabled;
  const soldOrders = (orders ?? []).filter(
    (o) => o.role === 'seller' && (o.status === 'paid' || o.status === 'refunded'),
  );

  function openEmbedded(nextMode: 'onboarding' | 'payouts' | 'management') {
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
                  ? "Buyers can pay you directly through Relay — Stripe holds the funds in Relay's own account until the buyer confirms receipt (or 14 days after you mark an order shipped), then sends your payout to your bank account."
                  : "Set this up once and buyers can pay you in-app, instead of arranging payment separately."}
              </p>
            </div>
          </div>
          {chargesEnabled && mode === null && (
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
            Payouts are handled by Stripe — you'll verify your identity and bank details right here.
            Relay takes a small commission on each sale; the rest sits in Relay's own Stripe balance
            until the buyer confirms receipt (or automatically after 14 days), then transfers to you.
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
            {mode !== 'onboarding' && (
              <button
                onClick={() => {
                  setMode(null);
                  setConnectInstance(null);
                }}
                className="mt-4 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              >
                {chargesEnabled ? 'Back to sold items' : 'Back'}
              </button>
            )}
          </div>
        ) : chargesEnabled ? (
          <div className="mt-5">
            <button
              onClick={() => openEmbedded('payouts')}
              className="flex items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
            >
              <Wallet size={15} /> View Stripe balance
            </button>

            <h3 className="mt-6 mb-3 text-sm font-medium text-[var(--color-ink-soft)]">Sold items</h3>
            {soldOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-8 text-center text-sm text-[var(--color-ink-soft)]">
                Nothing sold yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)]">
                {soldOrders.map((o) => {
                  const link = o.listingId ? `/listing/${o.listingId}` : o.bundleId ? `/club-gear/${o.bundleId}` : null;
                  const payout = o.amount - o.platformFeeAmount;
                  const row = (
                    <div className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <ListingRefRow
                          title={o.title}
                          photos={o.photos}
                          sport={o.sport}
                          location={o.location}
                          country={o.country}
                        />
                        <p className="mt-1 text-xs text-[var(--color-ink-soft)]/80">
                          {timeAgo(o.createdAt.slice(0, 10))} · to {o.counterpartyName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-[var(--color-moss)]">
                          {o.status === 'refunded' ? formatPrice(0, o.currency) : formatPrice(payout, o.currency)}
                        </p>
                        <Badge tone={o.status === 'refunded' ? 'neutral' : transferTone(o.transferStatus)}>
                          {o.status === 'refunded' ? 'refunded' : o.transferStatus}
                        </Badge>
                      </div>
                    </div>
                  );
                  return link ? (
                    <Link key={o.id} to={link} className="block hover:bg-[var(--color-paper)]">
                      {row}
                    </Link>
                  ) : (
                    <div key={o.id}>{row}</div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => openEmbedded('onboarding')}
              disabled={checking}
              className="flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              Set up payouts with Stripe
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
