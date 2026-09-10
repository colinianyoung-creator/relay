import { LegalDraftNotice } from '@/components/LegalDraftNotice';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Who controls your data',
    body: (
      <p>
        Relay ("we") is the data controller for the personal data described here. This policy
        covers everyone who creates an account, browses, or transacts on Relay.
      </p>
    ),
  },
  {
    title: '2. What we collect',
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account details:</strong> name, email, password (stored hashed by our auth
            provider), optional club affiliation.
          </li>
          <li>
            <strong>Listing content:</strong> whatever you choose to publish —
            title, description, photos, price, location, measurements.
          </li>
          <li>
            <strong>Messages:</strong> content you send to another member through Relay.
          </li>
          <li>
            <strong>Fit profile (optional):</strong> height, weight, seat dimensions, primary
            sport, classification, and free-text disability notes, used only to check whether a
            listing is likely to fit you.
          </li>
          <li>
            <strong>Transaction data:</strong> listing fee and purchase records, amounts,
            currency, and payment status — not full card numbers, which Stripe holds directly.
          </li>
          <li>
            <strong>Technical data:</strong> basic device/browser information and, if you install
            Relay as an app, offline cache data stored on your own device.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: '3. Your fit profile is special category data',
    body: (
      <p>
        Your fit profile's classification and disability-notes fields can reveal information
        about your health or disability. Under UK/EU GDPR this is "special category data" and
        gets extra protection. We only ask for it because you choose to fill in a fit profile, we
        only use it to compare against listing measurements, we don't use it for advertising or
        share it with anyone outside Relay, and you can clear it at any time from your account.
        Filling in a fit profile is entirely optional — Relay works without one.
      </p>
    ),
  },
  {
    title: '4. Why we process it (legal basis)',
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account, listings, messages, payments: necessary to perform our contract with you.</li>
          <li>Fit profile: your explicit consent, given by choosing to complete it.</li>
          <li>Fraud prevention and enforcing our Terms: our legitimate interest.</li>
          <li>Tax/accounting records: legal obligation.</li>
        </ul>
      </>
    ),
  },
  {
    title: '5. Who we share it with',
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Stripe</strong> — processes payments and, for sellers who enable payouts,
            verifies identity and bank details directly. Stripe acts as an independent controller
            for that verification.
          </li>
          <li>
            <strong>Supabase</strong> — hosts our database, authentication, and file storage as
            our data processor.
          </li>
          <li>Other Relay members — only what you choose to put in a public listing, your public
            profile, or a message you send them.
          </li>
        </ul>
        <p className="mt-3">We don't sell personal data, and we don't share it with advertisers.</p>
      </>
    ),
  },
  {
    title: '6. International transfers',
    body: (
      <p>
        Our database is hosted in the EU. Stripe processes payments globally, including in the
        US, under its own standard contractual safeguards. Where your data leaves the UK/EEA, we
        rely on those safeguards (such as Standard Contractual Clauses) being in place.
      </p>
    ),
  },
  {
    title: '7. How long we keep it',
    body: (
      <p>
        Account and listing data for as long as your account is active, plus a limited period
        afterwards to handle disputes and meet accounting/tax obligations. You can delete
        individual listings, messages, and your fit profile at any time; deleting your account
        removes the rest, subject to what we're legally required to retain.
      </p>
    ),
  },
  {
    title: '8. Cookies and local storage',
    body: (
      <p>
        Relay uses your browser's local storage to keep you signed in and, if installed as an
        app, to cache the app shell for offline use. We don't use third-party advertising or
        tracking cookies.
      </p>
    ),
  },
  {
    title: '9. Your rights',
    body: (
      <>
        <p>
          Subject to applicable law, you can ask to access, correct, delete, or export your data,
          object to or restrict certain processing, and withdraw consent for your fit profile at
          any time (this doesn't affect processing before you withdrew it). Contact us to
          exercise any of these.
        </p>
        <p className="mt-3">
          If you're in the UK or EU and unhappy with our response, you can complain to your local
          data protection authority (the ICO, in the UK).
        </p>
      </>
    ),
  },
  {
    title: '10. Children',
    body: <p>Relay is not directed at, and accounts are not available to, anyone under 18.</p>,
  },
  {
    title: '11. Changes to this policy',
    body: (
      <p>
        We'll update this page as Relay's features change and flag material changes here.
      </p>
    ),
  },
  {
    title: '12. Contact',
    body: <p>colinianyoung@gmail.com</p>,
  },
];

export function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        Legal
      </p>
      <h1 className="text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Last updated: draft, unpublished.</p>

      <div className="mt-8">
        <LegalDraftNotice />
      </div>

      <div className="space-y-8 text-[15px] leading-relaxed text-[var(--color-ink)]">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 text-lg">{s.title}</h2>
            <div className="text-[var(--color-ink-soft)]">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
