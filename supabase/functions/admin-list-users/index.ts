// Lists every user for the admin console. Needs the service-role key for
// two reasons the client can't do itself: reading auth.users (email isn't
// in the public schema PostgREST exposes) and calling the Auth Admin API
// for each user's ban status.
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
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Good enough for now — revisit pagination once Relay has more than a
    // couple hundred accounts.
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, club, verified, is_admin, rating, sales_count, stripe_connect_charges_enabled, created_at');
    if (profilesError) throw profilesError;

    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const users = authUsers.users.map((u) => {
      const profile = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? '(no email)',
        name: profile?.name ?? '(no profile)',
        club: profile?.club ?? null,
        verified: profile?.verified ?? false,
        isAdmin: profile?.is_admin ?? false,
        rating: profile?.rating ?? 5,
        salesCount: profile?.sales_count ?? 0,
        payoutsEnabled: profile?.stripe_connect_charges_enabled ?? false,
        createdAt: profile?.created_at ?? u.created_at,
        bannedUntil: u.banned_until ?? null,
      };
    });

    users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Could not load users.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
