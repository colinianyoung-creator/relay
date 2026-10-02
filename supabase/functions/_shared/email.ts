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

// Table-based layout and inline styles throughout — web fonts and CSS
// variables aren't reliable across email clients (Outlook especially), so
// this hand-mirrors the app's tokens (src/index.css) as literal values
// instead of importing them.
const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Wraps a notification's inner HTML in Relay's branded email shell: logo
 * header, card body, optional CTA button, footer. `bodyHtml` is the
 * message-specific content only (e.g. "<p>Your offer was accepted.</p>").
 */
export function wrapEmailBody({
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta = ctaLabel && ctaUrl
    ? `
      <tr>
        <td style="padding: 8px 40px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="border-radius: 999px; background-color: #ff4d2e;">
                <a href="${ctaUrl}" style="display: inline-block; padding: 12px 26px; font-family: ${EMAIL_FONT_STACK}; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none;">
                  ${ctaLabel}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f6f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f6f9;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e3e5ec;">
            <tr>
              <td align="center" style="padding: 28px 40px 20px; border-bottom: 1px solid #e3e5ec;">
                <img src="${SITE_URL}/logo.png" width="150" alt="Relay" style="display: block; width: 150px; height: auto; border: 0;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 40px 8px; font-family: ${EMAIL_FONT_STACK}; font-size: 15px; line-height: 1.6; color: #12131a;">
                ${bodyHtml}
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding: 20px 40px 28px; border-top: 1px solid #e3e5ec;">
                <p style="margin: 0; font-family: ${EMAIL_FONT_STACK}; font-size: 12px; color: #5b5e6b;">
                  Relay — adaptive sports equipment, matched by fit.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
