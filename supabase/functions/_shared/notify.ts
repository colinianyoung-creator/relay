// One-line-per-call-site email notification, built on top of sendEmail.
// Never throws — a failed/missing email must never turn an otherwise-
// successful message/offer action into a user-facing error.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, SITE_URL, wrapEmailBody } from './email.ts';

export async function notifyUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  subject: string,
  bodyHtml: string,
): Promise<void> {
  try {
    const [{ data: profile }, authRes] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', userId).single(),
      supabase.auth.admin.getUserById(userId),
    ]);
    const email = authRes.data.user?.email;
    if (!email) return;
    await sendEmail({
      to: email,
      subject,
      html: wrapEmailBody({
        bodyHtml: `<p style="margin: 0 0 12px;">Hi ${profile?.name ?? 'there'},</p>${bodyHtml}`,
        ctaLabel: 'View on Relay',
        ctaUrl: `${SITE_URL}/account`,
      }),
    });
  } catch (err) {
    console.error('notifyUser failed for', userId, err);
  }
}
