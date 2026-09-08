// Resolves an email to a real Relay account, so a seller can invoice a
// buyer they've been negotiating with — the client has no visibility into
// other users' emails otherwise. Any signed-in user can call this (not
// admin-only); it does let someone check whether an email has a Relay
// account, a minor enumeration surface acceptable at this prototype's scale.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
      data: { user: caller },
      error: callerError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No direct "get user by email" in the admin API — list + filter. Fine
    // at this scale; revisit if the user base grows large enough to matter.
    const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const match = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!match) {
      return new Response(JSON.stringify({ error: 'No Relay account found with that email.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (match.id === caller.id) {
      return new Response(JSON.stringify({ error: "That's your own account." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase.from('profiles').select('name').eq('id', match.id).single();

    return new Response(JSON.stringify({ id: match.id, name: profile?.name ?? 'Relay member' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Could not look up that email.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
