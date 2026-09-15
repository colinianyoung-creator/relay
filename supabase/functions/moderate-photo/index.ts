// Blocks photos of minors before they ever reach Storage — called by
// uploadListingPhoto/uploadAvatar with the raw file bytes, ahead of the
// actual upload, so a flagged image is never even briefly public.
// Fails open on any Sightengine-side error: this is defense-in-depth, not
// the only safeguard (listing_reports still covers anything that slips
// through), and a third-party outage shouldn't block every upload.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MINOR_THRESHOLD = 0.5;

interface SightengineFace {
  attributes?: { age?: { minor?: number } };
}
interface SightengineResponse {
  status?: string;
  faces?: SightengineFace[];
}

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

    const incoming = await req.formData();
    const file = incoming.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const apiUser = Deno.env.get('SIGHTENGINE_API_USER')!;
      const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET')!;

      const outgoing = new FormData();
      outgoing.set('media', file, file.name);
      outgoing.set('models', 'face-age');
      outgoing.set('api_user', apiUser);
      outgoing.set('api_secret', apiSecret);

      const sightengineRes = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: outgoing,
      });
      const result: SightengineResponse = await sightengineRes.json();
      if (!sightengineRes.ok || result.status !== 'success') {
        throw new Error(`Sightengine error: ${JSON.stringify(result)}`);
      }

      const flagged = (result.faces ?? []).some(
        (face) => (face.attributes?.age?.minor ?? 0) >= MINOR_THRESHOLD,
      );

      return new Response(JSON.stringify({ allowed: !flagged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (moderationErr) {
      console.error('moderate-photo: Sightengine check failed, failing open', moderationErr);
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong checking this photo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
