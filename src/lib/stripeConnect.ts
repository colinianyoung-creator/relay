import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from '@stripe/connect-js';
import { createConnectAccountSession } from '@/lib/supabaseData';

// Embedded rather than a redirect to a Stripe-hosted page — the seller never
// leaves Relay, and the UI is themed to match via the appearance option
// below, mirroring src/index.css's own tokens.
export function getConnectInstance(): StripeConnectInstance {
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
