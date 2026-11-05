// Public feedback from the site's Feedback button. Works signed out, so JWT
// verification is off (see config.toml); abuse is limited here instead:
// a honeypot field, per-sender and global caps, and strict length checks.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, SITE_URL, wrapEmailBody } from '../_shared/email.ts';

const MAX_MESSAGE = 2000;
const PER_SENDER_PER_HOUR = 5;
const GLOBAL_PER_DAY = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400);

    // Bots fill every field. Pretend it worked so they don't adapt.
    if (typeof body.website === 'string' && body.website.trim() !== '') return json({ ok: true });

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'Please write a message first.' }, 400);
    if (message.length > MAX_MESSAGE) {
      return json({ error: `Please keep it under ${MAX_MESSAGE} characters.` }, 400);
    }

    let contactEmail: string | null = null;
    if (typeof body.email === 'string' && body.email.trim() !== '') {
      const e = body.email.trim();
      if (e.length > 254 || !EMAIL_RE.test(e)) {
        return json({ error: "That email address doesn't look right." }, 400);
      }
      contactEmail = e;
    }

    const pagePath =
      typeof body.pagePath === 'string' && body.pagePath.startsWith('/')
        ? body.pagePath.slice(0, 200)
        : null;
    const viewport =
      typeof body.viewport === 'string' && /^\d{2,5}x\d{2,5}$/.test(body.viewport)
        ? body.viewport
        : null;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Signed-in senders are identified by their token; the anon key the
    // browser sends otherwise just fails getUser and counts as anonymous.
    let userId: string | null = null;
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    const salt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const senderHash = await sha256Hex(`${userId ?? ip}:${salt}`);

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: recent }, { count: today }] = await Promise.all([
      supabase
        .from('feedback_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('sender_hash', senderHash)
        .gte('created_at', hourAgo),
      supabase
        .from('feedback_submissions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dayAgo),
    ]);
    if ((recent ?? 0) >= PER_SENDER_PER_HOUR) {
      return json({ error: "You've sent a few already. Please try again in a while." }, 429);
    }
    if ((today ?? 0) >= GLOBAL_PER_DAY) {
      return json({ error: 'Feedback is busy right now. Please try again later.' }, 429);
    }

    const { error: insertError } = await supabase.from('feedback_submissions').insert({
      user_id: userId,
      message,
      contact_email: contactEmail,
      page_path: pagePath,
      viewport,
      sender_hash: senderHash,
    });
    if (insertError) {
      console.error('feedback insert failed', insertError);
      return json({ error: "Couldn't send that. Please try again in a moment." }, 500);
    }

    // FEEDBACK_NOTIFY_EMAIL (a shared inbox) wins; without it, fall back to
    // each admin account's own login email.
    const notifyEmail = Deno.env.get('FEEDBACK_NOTIFY_EMAIL')?.trim();
    let recipients: string[] = notifyEmail ? [notifyEmail] : [];
    if (recipients.length === 0) {
      const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
      const found = await Promise.all(
        (admins ?? []).map(async (a: { id: string }) => {
          const res = await supabase.auth.admin.getUserById(a.id);
          return res.data.user?.email ?? null;
        }),
      );
      recipients = found.filter((e): e is string => !!e);
    }

    let senderName = 'A visitor (not signed in)';
    if (userId) {
      const { data: p } = await supabase.from('profiles').select('name').eq('id', userId).single();
      senderName = p?.name ?? 'A Relay member';
    }
    const bodyHtml = `
      <p style="margin: 0 0 12px;"><strong>New feedback</strong> from ${escapeHtml(senderName)}${
        contactEmail ? ` (${escapeHtml(contactEmail)})` : ''
      }</p>
      <p style="margin: 0 0 12px; white-space: pre-wrap; padding: 12px 14px; background: #f5f6f9; border-radius: 10px;">${escapeHtml(message)}</p>
      <p style="margin: 0; font-size: 13px; color: #5b5e6b;">Page: ${escapeHtml(pagePath ?? 'unknown')}${
        viewport ? ` · Screen: ${escapeHtml(viewport)}` : ''
      }</p>`;
    // Awaited so the runtime doesn't cut it off; sendEmail never throws, so a
    // mail problem can't fail the submission.
    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: 'New feedback on Relay',
          html: wrapEmailBody({
            bodyHtml,
            ctaLabel: 'Open the feedback inbox',
            ctaUrl: `${SITE_URL}/admin/feedback`,
          }),
        }),
      ),
    );

    return json({ ok: true });
  } catch (err) {
    console.error('submit-feedback failed', err);
    return json({ error: "Couldn't send that. Please try again in a moment." }, 500);
  }
});
