import { LegalDraftNotice } from '@/components/LegalDraftNotice';

// Structured against the ICO's list of required privacy information
// (ico.org.uk "What privacy information should we provide?"). Still to do
// before this stops being a draft: add the registered business details and
// ICO registration number to section 1, confirm each provider's transfer
// mechanism, and have a solicitor check the transfers and legitimate-interests
// wording.
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. Who we are',
    body: (
      <>
        <p>
          Relay ("we") is the data controller for the personal data described here. This policy
          covers everyone who creates an account, browses, or transacts on Relay.
        </p>
        <p className="mt-3">
          Relay is currently run by its founder, Colin Young, based in Scotland. We'll add our
          registered business details here once they're in place. You can contact us at
          help@relayadaptive.com.
        </p>
      </>
    ),
  },
  {
    title: '2. What we collect, and where it comes from',
    body: (
      <>
        <p>Most of this comes from you directly:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Account details:</strong> name, email, password (stored hashed by our auth
            provider), optional club affiliation.
          </li>
          <li>
            <strong>Listing content:</strong> whatever you choose to publish — title,
            description, photos, price, location, measurements.
          </li>
          <li>
            <strong>Messages and offers:</strong> content you send to another member through
            Relay.
          </li>
          <li>
            <strong>Fit profile (optional):</strong> height, weight, seat dimensions, primary
            sport, classification, and free-text disability notes, used only to check whether a
            listing is likely to fit you.
          </li>
          <li>
            <strong>Transaction data:</strong> listing fee and purchase records, amounts,
            currency, delivery details you give for an order, and payment status — not full card
            numbers, which Stripe holds directly.
          </li>
          <li>
            <strong>Saved searches:</strong> the filters you ask us to watch, so we can email you
            when a matching listing appears.
          </li>
          <li>
            <strong>Feedback:</strong> if you use the Feedback button (signed in or not), the
            message you write, the email address if you give one, the page you were on and your
            screen size. Anonymous senders are rate-limited using a one-way hash of their
            internet address, not the address itself.
          </li>
          <li>
            <strong>Technical data:</strong> basic device and browser information and your
            internet address, which our hosting and database providers log when you use Relay.
            If you install Relay as an app, offline cache data is stored on your own device.
          </li>
        </ul>
        <p className="mt-3">Some comes from other places:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Google</strong>, if you choose "Continue with Google": your name, email
            address and profile picture.
          </li>
          <li>
            <strong>Stripe</strong>, if you set up payouts: whether your identity and bank
            verification was approved, and the status of your payments and payouts. We don't
            receive your identity documents or bank details.
          </li>
          <li>
            <strong>Other Relay members:</strong> messages, offers, reviews and reports that
            mention you.
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
        about your health or disability. Under UK GDPR this is "special category data" and gets
        extra protection. We only ask for it because you choose to fill in a fit profile, we
        only use it to compare against listing measurements, we don't use it for advertising or
        share it with anyone outside Relay, and you can clear it at any time from your account.
        Filling in a fit profile is entirely optional — Relay works without one.
      </p>
    ),
  },
  {
    title: '4. Why we use it (purposes and legal basis)',
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Running your account and the marketplace</strong> (listings, messages, offers,
            orders, reviews): necessary to perform our contract with you.
          </li>
          <li>
            <strong>Taking payments, holding them until delivery, paying out and handling
            refunds:</strong> necessary to perform our contract with you.
          </li>
          <li>
            <strong>Emails about your activity</strong> (messages, offers, orders, refunds) and
            <strong> saved-search alerts</strong> you set up: necessary to perform our contract
            with you.
          </li>
          <li>
            <strong>Checking whether kit is likely to fit you:</strong> your explicit consent,
            given by choosing to complete a fit profile.
          </li>
          <li>
            <strong>Checking uploaded photos</strong> (listing photos and profile pictures)
            automatically, to stop images of children being published: our legitimate interest in
            keeping Relay safe.
          </li>
          <li>
            <strong>Preventing fraud and enforcing our Terms:</strong> our legitimate interest.
          </li>
          <li>
            <strong>Reading and replying to feedback and support requests,</strong> and improving
            Relay: our legitimate interest.
          </li>
          <li>
            <strong>Tax, accounting and reporting duties,</strong> including reporting seller
            information to HMRC where the law requires it: legal obligation.
          </li>
        </ul>
        <p className="mt-3">
          Where we rely on legitimate interests, the interest is running a safe, trustworthy
          marketplace and improving it. We've weighed that against your rights and expectations,
          and you can object (see section 11).
        </p>
      </>
    ),
  },
  {
    title: '5. Do you have to give us your data?',
    body: (
      <p>
        You can browse Relay without giving us anything. To create an account we need your name
        and email; without them you can't list, buy, message or make offers. To receive payouts,
        Stripe must verify your identity and bank details; without that you can't sell priced
        items. Your fit profile, club affiliation, feedback and saved searches are always
        optional.
      </p>
    ),
  },
  {
    title: '6. Who we share it with',
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
          <li>
            <strong>Vercel</strong> — hosts the Relay website as our data processor.
          </li>
          <li>
            <strong>Resend</strong> — sends our emails (account, activity and alert emails) as
            our data processor.
          </li>
          <li>
            <strong>Sightengine</strong> — receives each photo you upload (listing photos and
            profile pictures) so it can be checked automatically for children's faces, as our
            data processor.
          </li>
          <li>
            <strong>Zoho</strong> — our support mailbox, which holds emails you send to us.
          </li>
          <li>
            <strong>Google</strong> — only if you sign in with Google, to confirm your identity.
          </li>
          <li>
            <strong>Open-Meteo</strong> — a place-name lookup that suggests towns and cities as you
            type in a "Town or city" field when listing equipment. Your browser sends it the text
            you have typed in that field, and, as with any web request, your IP address. We send
            nothing else, and nothing about your account or listing.
          </li>
          <li>
            <strong>HMRC and other authorities</strong> — where the law requires us to report or
            disclose information.
          </li>
          <li>
            <strong>Other Relay members</strong> — only what you choose to put in a public
            listing, your public profile, or a message you send them.
          </li>
        </ul>
        <p className="mt-3">We don't sell personal data, and we don't share it with advertisers.</p>
      </>
    ),
  },
  {
    title: '7. Automated checks',
    body: (
      <p>
        Uploaded photos are checked automatically, and a photo that appears to show a child is
        rejected before it's published. This doesn't change your legal rights, but if you think a
        photo was wrongly rejected, email us and a person will look at it. We don't use your data
        for automated decisions about you beyond this, and we don't profile you for advertising.
      </p>
    ),
  },
  {
    title: '8. International transfers',
    body: (
      <>
        <p>
          Our database and file storage are hosted in Ireland (the EU), which the UK recognises as
          providing adequate protection. Some of our other providers, such as Stripe, Vercel and
          Resend, may process data in the United States or other countries outside the UK/EEA.
          We choose providers that rely on safeguards recognised under UK law for those
          transfers, such as the UK–US data bridge or standard contractual clauses with the UK
          addendum.
        </p>
        <p className="mt-3">
          You can email us for details of the safeguards that apply to a given provider and for a
          copy of them.
        </p>
      </>
    ),
  },
  {
    title: '9. How long we keep it',
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account, listings, messages and offers:</strong> while your account is
            active. You can delete individual listings and messages yourself. If you email us to
            delete your account we remove or anonymise the rest, except what we need to deal with
            a dispute that's already open or must keep by law.
          </li>
          <li>
            <strong>Orders, payments and fee records:</strong> six years from the end of the
            financial year they relate to, because tax and accounting law requires us to keep
            them.
          </li>
          <li>
            <strong>Fit profile:</strong> until you clear it yourself or ask us to delete your account.
          </li>
          <li>
            <strong>Feedback:</strong> until we've dealt with it, then reviewed regularly and
            deleted when no longer useful — we aim to do that within 12 months.
          </li>
          <li>
            <strong>Photos sent for checking:</strong> we don't keep a separate copy for the check,
            and a rejected photo is never stored by us. How long Sightengine keeps images it
            receives is set out in its own privacy policy.
          </li>
          <li>
            <strong>Support emails:</strong> as long as needed to deal with your request and any
            follow-up.
          </li>
        </ul>
        <p className="mt-3">
          Where nothing above fits, we keep data only for as long as we need it for the purpose we
          collected it for, and for any legal limit that applies.
        </p>
      </>
    ),
  },
  {
    title: '10. Cookies and local storage',
    body: (
      <p>
        Relay uses your browser's local storage to keep you signed in, remember small settings
        (like recent searches and a dismissed banner), and, if installed as an app, to cache the
        app shell for offline use. These are needed for the site to work as you'd expect. We don't
        use third-party advertising or tracking cookies or analytics.
      </p>
    ),
  },
  {
    title: '11. Your rights',
    body: (
      <>
        <p>
          Subject to applicable law, you can ask to access, correct, delete, or export your data,
          restrict how we use it, and withdraw consent for your fit profile at any time (this
          doesn't affect processing before you withdrew it). Email help@relayadaptive.com to
          exercise any of these; we'll reply within one month.
        </p>
        <p className="mt-3">
          <strong>Right to object.</strong> You can object at any time to us using your data on the
          basis of our legitimate interests (section 4). Tell us what you object to and we'll stop
          unless we have strong, compelling reasons not to, or need the data for legal claims.
        </p>
        <p className="mt-3">
          <strong>Complaints.</strong> Please contact us first so we can try to put things right.
          You can also complain to the Information Commissioner's Office (ICO) at
          ico.org.uk/make-a-complaint or on 0303 123 1113.
        </p>
      </>
    ),
  },
  {
    title: '12. Children',
    body: <p>Relay is not directed at, and accounts are not available to, anyone under 18.</p>,
  },
  {
    title: '13. Changes to this policy',
    body: (
      <p>
        We review this policy at least once a year and whenever Relay's features change, and
        we'll flag material changes on this page.
      </p>
    ),
  },
  {
    title: '14. Contact',
    body: <p>help@relayadaptive.com</p>,
  },
];

export function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        Legal
      </p>
      <h1 className="text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Last updated: 22 November 2026.</p>

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
