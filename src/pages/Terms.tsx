import { LegalDraftNotice } from '@/components/LegalDraftNotice';
import { LISTING_FEE_GBP } from '@/lib/supabaseData';

// Kept in sync by hand with PLATFORM_FEE_PERCENT in
// supabase/functions/create-purchase-checkout/index.ts — update both if this changes.
const PLATFORM_FEE_PERCENT = 5;

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. What Relay is',
    body: (
      <>
        <p>
          Relay is an online marketplace that connects people buying and selling adaptive sports
          equipment. When you list, buy or sell through Relay, the contract of sale is between
          you and the other member — <strong>Relay is not a party to that sale</strong>, does not
          own, inspect, or guarantee any item listed, and is not a manufacturer or retailer of the
          equipment on the platform.
        </p>
        <p className="mt-3">
          Relay's role is to host listings, help buyers and sellers find each other, provide
          optional in-app messaging and payment tools, and take a fee for that service as set out
          below.
        </p>
      </>
    ),
  },
  {
    title: '2. Accounts and eligibility',
    body: (
      <p>
        You must be at least 18 years old and able to form a binding contract to buy or sell on
        Relay. You're responsible for the accuracy of your account and listing information and
        for keeping your login credentials secure. One account per person — accounts are not
        transferable.
      </p>
    ),
  },
  {
    title: '3. Listings',
    body: (
      <>
        <p>
          Sellers must describe items accurately, including condition, dimensions, and any
          damage or safety-relevant defects. Photos should be of the actual item where
          reasonably possible. Relay may remove a listing, or ask a seller to amend it, at any
          time — including in response to a safety report — without that being an admission the
          listing was actually unlawful or unsafe.
        </p>
        <p className="mt-3">You may not list:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Items you don't own or aren't authorised to sell</li>
          <li>Stolen, counterfeit, or recalled equipment</li>
          <li>Equipment with a known safety defect that isn't clearly disclosed in the listing</li>
          <li>Anything unrelated to adaptive/para-sport equipment</li>
          <li>Items whose sale would breach export, sanctions, or other applicable law</li>
        </ul>
      </>
    ),
  },
  {
    title: '4. Fees',
    body: (
      <>
        <p>
          Publishing a for-sale listing (i.e. anything with a price, not marked free/donation)
          costs a flat <strong>£{LISTING_FEE_GBP}</strong>, charged once via Stripe Checkout when
          you create the listing. Free/donation listings and Wanted posts are not charged.
        </p>
        <p className="mt-3">
          If a seller has payouts enabled and a buyer pays through Relay's in-app checkout, Relay
          takes a <strong>{PLATFORM_FEE_PERCENT}% commission</strong> on the sale price, deducted
          automatically before the remainder is transferred to the seller — the buyer is never
          charged more than the listed price. Both fees are shown before you pay and are
          non-refundable except where required by law or at Relay's discretion.
        </p>
      </>
    ),
  },
  {
    title: '5. Payment',
    body: (
      <>
        <p>
          Where a seller has completed payouts setup, buyers may pay in-app via Stripe Checkout.
          Relay never sees or stores your card details, and funds are transferred by Stripe
          directly to the seller's own connected account, minus Relay's commission — Relay itself
          never holds buyer funds.
        </p>
        <p className="mt-3">
          Where in-app payment isn't available, or either party prefers it, buyers and sellers
          are free to arrange payment and collection between themselves, exactly as in any
          private sale. Relay is not responsible for payments made outside its checkout.
        </p>
      </>
    ),
  },
  {
    title: '6. Delivery, collection and shipping',
    body: (
      <p>
        Buyers and sellers arrange collection or shipping between themselves. If a listing ships
        internationally, the buyer is responsible for any customs duties, import taxes, or
        freight costs unless the seller states otherwise in the listing. Relay is not a party to,
        and has no liability for, any shipping arrangement.
      </p>
    ),
  },
  {
    title: '7. Cancellations, returns and disputes',
    body: (
      <>
        <p>
          Most sales on Relay are private sales between individuals and are final — statutory
          rights to cancel or return within a set period generally apply only where a seller is
          acting in the course of a business, not as a private individual selling their own
          equipment. Sellers acting in the course of business must comply with applicable
          consumer law in their and the buyer's jurisdiction, including pre-contract information
          and cancellation rights.
        </p>
        <p className="mt-3">
          If an in-app payment is disputed (e.g. a Stripe chargeback), Relay will cooperate with
          Stripe's dispute process but is not itself an arbiter of the underlying disagreement
          between buyer and seller. We'd rather you never need this — message first, and be
          precise about condition before you pay.
        </p>
      </>
    ),
  },
  {
    title: '8. Seller payouts',
    body: (
      <p>
        Accepting in-app payment requires completing identity and bank verification directly
        with Stripe, our payment processor. Relay does not control, and is not responsible for,
        Stripe's decision to approve, restrict, or close a Connect account.
      </p>
    ),
  },
  {
    title: '9. Account suspension',
    body: (
      <p>
        Relay may suspend or close an account that breaches these terms, misuses the platform, or
        poses a safety or legal risk to other members. Where reasonably possible we'll explain
        why.
      </p>
    ),
  },
  {
    title: '10. Liability',
    body: (
      <p>
        Relay provides the marketplace "as is." To the fullest extent permitted by law, Relay
        isn't liable for the condition, safety, legality, or accuracy of any listing, the conduct
        of any buyer or seller, or losses arising from a transaction between members. Nothing in
        these terms excludes liability that can't be excluded by law (for example, for fraud, or
        death or personal injury caused by our own negligence).
      </p>
    ),
  },
  {
    title: '11. Changes to these terms',
    body: (
      <p>
        We may update these terms as Relay's features change. Material changes will be flagged
        on this page; continuing to use Relay after a change means you accept the update.
      </p>
    ),
  },
  {
    title: '12. Governing law',
    body: (
      <p>
        These terms are governed by the law of England and Wales, without prejudice to any
        mandatory consumer-protection rights you have under the law of your own country of
        residence.
      </p>
    ),
  },
  {
    title: '13. Contact',
    body: <p>Questions about these terms: colinianyoung@gmail.com</p>,
  },
];

export function Terms() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        Legal
      </p>
      <h1 className="text-4xl">Terms of Service</h1>
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
