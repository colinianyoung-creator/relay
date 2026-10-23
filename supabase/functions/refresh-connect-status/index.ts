// Pulls the caller's Connect account status directly from Stripe and syncs
// profiles.stripe_connect_charges_enabled. Called when a seller lands back
// on /account after onboarding, and from a manual "check status" button —
// see the comment in connect-onboarding for why we don't rely on Connect
// webhooks for this instead.
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { corsHeaders } from '../_shared/cors.ts';
import { checkConnectAccount } from '../_shared/connectAccount.ts';

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ chargesEnabled: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Also self-heals a dead account ID (e.g. left over from Stripe test
    // mode): clears it, so the seller sees "set up payouts" and can start over.
    const check = await checkConnectAccount(
      supabase,
      stripe,
      user.id,
      profile.stripe_connect_account_id,
      profile.stripe_connect_charges_enabled,
    );
    const chargesEnabled = check.status === 'ok' && check.chargesEnabled;

    return new Response(JSON.stringify({ chargesEnabled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Could not check payouts status.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
