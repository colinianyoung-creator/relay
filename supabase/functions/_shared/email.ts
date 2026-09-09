// Thin wrapper around Resend's HTTP API — no SDK needed for one endpoint.
// Never throws: a failed send is logged and swallowed, since email delivery
// must never turn a webhook's DB-write success into a Stripe-facing error
// (which would trigger pointless retries of already-completed work).
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping email:', subject);
    return;
  }
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Relay <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error('Resend send failed', res.status, await res.text());
  } catch (err) {
    console.error('Resend send threw', err);
  }
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://relay-marketplace-kappa.vercel.app';
