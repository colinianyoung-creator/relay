// Called right after a free/exempt listing (or fleet lot) goes live —
// stripe-webhook does the equivalent check inline for the two paid paths
// since it's already running server-side there. Checks every listing id
// against every saved search and emails each matching user once.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/notify.ts';
import { formatMoney, SITE_URL } from '../_shared/email.ts';
import { listingMatchesSearch, type SavedSearch } from '../_shared/matchSearch.ts';

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

    const { listingIds } = await req.json();
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing listingIds' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, title, price, currency, sport, condition, country, ships_internationally, location, fee_status, bundle_id')
      .in('id', listingIds);
    if (listingsError) throw listingsError;

    const liveListings = (listings ?? []).filter((l) => l.fee_status === 'paid' || l.fee_status === 'exempt');
    if (liveListings.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: searches, error: searchesError } = await supabase
      .from('saved_searches')
      .select('user_id, sport, condition, country, min_price, max_price, free_only');
    if (searchesError) throw searchesError;

    // A user should get one email even if several of their searches, or
    // several new listings, all matched — collect matches per user first.
    const matchesByUser = new Map<string, typeof liveListings>();
    for (const search of (searches ?? []) as (SavedSearch & { user_id: string })[]) {
      for (const listing of liveListings) {
        if (listingMatchesSearch(listing, search)) {
          const existing = matchesByUser.get(search.user_id) ?? [];
          if (!existing.some((l) => l.id === listing.id)) existing.push(listing);
          matchesByUser.set(search.user_id, existing);
        }
      }
    }

    for (const [userId, matched] of matchesByUser) {
      const items = matched
        .map((l) => {
          const link = l.bundle_id ? `${SITE_URL}/fleet/${l.bundle_id}` : `${SITE_URL}/listing/${l.id}`;
          return `<li><a href="${link}">${l.title}</a> — ${formatMoney(l.price ?? 0, l.currency)}, ${l.location}</li>`;
        })
        .join('');
      await notifyUser(
        supabase,
        userId,
        matched.length === 1 ? 'New listing matches your saved search' : 'New listings match your saved search',
        `<p>Something new just went live that matches one of your saved searches:</p><ul>${items}</ul>`,
      );
    }

    return new Response(JSON.stringify({ ok: true, notified: matchesByUser.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong checking saved searches.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
