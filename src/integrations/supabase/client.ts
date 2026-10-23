import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

// Untyped client: this app hand-writes its own row/insert interfaces in
// src/lib/supabaseData.ts rather than generating full Database types, since
// the schema is small and stable. Trade-off: no compile-time column
// validation on .from()/.insert() calls, only on the mapped return shapes.
const SESSION_EXPIRED_MESSAGE =
  'Your session has expired — please sign out and sign back in, then try again.';

// Every edge function answers 401 { error: 'Not authenticated' } when it can't
// accept the caller's login token — which is what an expired or invalidated
// browser session looks like, but reads as a bug. Translate it once here so
// every function call (33 of them) shows something the person can act on.
const fetchWithFriendlyAuthErrors: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (response.status !== 401 || !requestUrl.includes('/functions/v1/')) return response;

  const body = await response
    .clone()
    .json()
    .catch(() => null);
  if (body?.error !== 'Not authenticated') return response;

  return new Response(JSON.stringify({ error: SESSION_EXPIRED_MESSAGE }), {
    status: response.status,
    statusText: response.statusText,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const supabase = createClient(url, publishableKey, {
  global: { fetch: fetchWithFriendlyAuthErrors },
});
