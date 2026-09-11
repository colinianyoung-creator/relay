// Routes message-sending through an edge function (rather than the client's
// previous direct RLS insert) purely so there's a server-side place to hook
// an email notification — same reasoning as every other write in this app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyUser } from '../_shared/notify.ts';

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

    const { listingId, recipientId, body } = await req.json();
    if (!listingId || !recipientId || !body) {
      return new Response(JSON.stringify({ error: 'Missing listingId, recipientId or body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({ listing_id: listingId, sender_id: user.id, recipient_id: recipientId, body })
      .select('id')
      .single();
    if (insertError || !message) {
      console.error(insertError);
      return new Response(JSON.stringify({ error: 'Could not send that message.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: sender }, { data: listing }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).single(),
      supabase.from('listings').select('title').eq('id', listingId).single(),
    ]);
    await notifyUser(
      supabase,
      recipientId,
      `New message from ${sender?.name ?? 'a Relay member'}`,
      `<p>About "${listing?.title ?? 'your listing'}":</p><p>${body}</p>`,
    );

    return new Response(JSON.stringify({ id: message.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong sending that message.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
