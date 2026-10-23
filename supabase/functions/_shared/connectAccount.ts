// Asks Stripe whether a seller's stored Connect account is actually usable,
// rather than trusting profiles.stripe_connect_charges_enabled alone — that
// flag is only a cache, and it goes stale in two ways: the account can be
// restricted after the fact, or (as when switching from Stripe test mode to
// live) the stored account ID can stop existing under the current API key.
// A buyer must never be charged for a seller who can't be paid, so every
// money-taking path checks this first.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

// resource_missing: no such account. account_invalid: the key has no access
// to it (another platform's account, or a test-mode account under a live key).
const STALE_ACCOUNT_CODES = ['resource_missing', 'account_invalid'];

export type ConnectCheck =
  | { status: 'missing' }
  | { status: 'stale' }
  | { status: 'ok'; chargesEnabled: boolean };

export async function checkConnectAccount(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  userId: string,
  accountId: string | null,
  cachedChargesEnabled: boolean,
): Promise<ConnectCheck> {
  if (!accountId) return { status: 'missing' };

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const chargesEnabled = !!account.charges_enabled;
    if (chargesEnabled !== cachedChargesEnabled) {
      await supabase
        .from('profiles')
        .update({ stripe_connect_charges_enabled: chargesEnabled })
        .eq('id', userId);
    }
    return { status: 'ok', chargesEnabled };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code && STALE_ACCOUNT_CODES.includes(code)) {
      // Clear it so the seller is shown "set up payouts" and can onboard
      // afresh, instead of every later call failing against a dead ID.
      await supabase
        .from('profiles')
        .update({ stripe_connect_account_id: null, stripe_connect_charges_enabled: false })
        .eq('id', userId);
      console.warn('Cleared stale Connect account for profile', userId, accountId);
      return { status: 'stale' };
    }
    throw err;
  }
}
