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
export const supabase = createClient(url, publishableKey);
