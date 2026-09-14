// Creates (or reuses) a Stripe Connect Express account for the calling
// seller and returns an Account Session client secret, which the frontend
// uses to mount Stripe's embedded onboarding/management UI directly inside
// Relay's own page — no redirect to a Stripe-hosted domain. See
// connect-onboarding/index.ts for the (now unused by the client, kept as a
// harmless fallback) hosted-redirect equivalent this replaces.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';
import { SITE_URL } from '../_shared/email.ts';

// Stripe's "Sporting Goods Stores" MCC — every seller on Relay sells the
// same kind of thing, so there's no reason to make each one pick this
// themselves during onboarding.
const SPORTING_GOODS_MCC = '5941';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Every Relay seller sells the same kind of thing (secondhand adaptive
    // sports kit) and, for most, has no business website of their own — set
    // this once here rather than making Stripe ask each seller to fill in
    // an "Edit professional details" step (industry / website / product
    // description) during onboarding. This is Stripe's card-network risk
    // classification (MCC), unrelated to VAT/tax status — every Connect
    // account needs it, individual or not, but it doesn't need to come from
    // the seller when the platform already knows the answer.
    const businessProfile = {
      mcc: SPORTING_GOODS_MCC,
      url: `${SITE_URL}/seller/${user.id}`,
      product_description: 'Secondhand adaptive sports equipment, sold peer-to-peer via Relay.',
    };

    let accountId = profile.stripe_connect_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        // Relay sellers are private individuals selling their own
        // secondhand kit, never a registered business — explicit rather
        // than left to Stripe's own default.
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: businessProfile,
        metadata: {
          platform: 'relay',
          seller_type: 'p2p_individual',
        },
      });
      accountId = account.id;
      await supabase
        .from('profiles')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', user.id);
    } else {
      // Backfill for accounts created before this field was set — keeps
      // existing sellers from hitting the same "professional details" step.
      await stripe.accounts.update(accountId, { business_profile: businessProfile });
    }

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
        // account_management alone only shows business/bank-detail settings
        // — payouts is the component that actually surfaces balance and
        // payout history, which is what a seller wants to see by default.
        payouts: { enabled: true },
      },
    });

    return new Response(JSON.stringify({ clientSecret: accountSession.client_secret }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong starting payouts setup.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
