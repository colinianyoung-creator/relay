// Single endpoint for every admin action on a user: verify/unverify,
// ban/unban, grant/revoke admin. All gated the same way — caller must be an
// admin themselves — and a couple of actions are blocked against the
// caller's own account so an admin can't accidentally lock themselves out.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Action = 'verify' | 'unverify' | 'ban' | 'unban' | 'grantAdmin' | 'revokeAdmin';
const SELF_BLOCKED_ACTIONS: Action[] = ['ban', 'revokeAdmin'];

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

    const { userId, action } = (await req.json()) as { userId?: string; action?: Action };
    if (!userId || !action) {
      return new Response(JSON.stringify({ error: 'Missing userId or action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userId === user.id && SELF_BLOCKED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "You can't do that to your own account." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Snapshot the target's name before acting, same reasoning as
    // listing_reports.listing_title_snapshot — the log entry should still
    // read sensibly even if the target account is later deleted.
    const { data: targetProfile } = await supabase.from('profiles').select('name').eq('id', userId).single();

    switch (action) {
      case 'verify':
      case 'unverify': {
        const { error } = await supabase
          .from('profiles')
          .update({ verified: action === 'verify' })
          .eq('id', userId);
        if (error) throw error;
        break;
      }
      case 'grantAdmin':
      case 'revokeAdmin': {
        const { error } = await supabase
          .from('profiles')
          .update({ is_admin: action === 'grantAdmin' })
          .eq('id', userId);
        if (error) throw error;
        break;
      }
      case 'ban':
      case 'unban': {
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: action === 'ban' ? '876000h' : 'none',
        });
        if (error) throw error;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { error: logError } = await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action,
      target_type: 'user',
      target_id: userId,
      details: { targetName: targetProfile?.name ?? null },
    });
    if (logError) console.error('Failed to write audit log entry', logError);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Could not update that user.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
