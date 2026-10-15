import { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { LegalDraftNotice } from '@/components/LegalDraftNotice';
import { LISTING_FEE_GBP } from '@/lib/supabaseData';

// Kept in sync by hand with the edge functions (create-purchase-checkout,
// accept-offer, create-custom-order) — update both if these change.
const PLATFORM_FEE_PERCENT = 5;
const PLATFORM_FEE_CAP_GBP = 150;

interface FaqEntry {
  question: string;
  answer: React.ReactNode;
}

interface FaqSection {
  id: string;
  title: string;
  entries: FaqEntry[];
}

// Tax is deliberately last and short — it's one concern among many, and the
// content stays hedged: UK tax treatment turns on HMRC's "badges of trade"
// test, not on who the seller is, so this page never declares a category of
// seller tax-free.
const SECTIONS: FaqSection[] = [
  {
    id: 'buying',
    title: 'Buying',
    entries: [
      {
        question: 'How do I know a chair or handcycle will fit me?',
        answer: (
          <p>
            Sellers add measurements where they can — seat width and depth, weight capacity, and
            the user height and weight the item suits. Use <strong>Set my size</strong> on the
            browse page to filter to kit that matches, and listings that look like a fit are
            flagged. Matching allows a bit of leeway rather than demanding an exact number, and
            your size is only used to filter and flag — it's never shown publicly.
          </p>
        ),
      },
      {
        question: 'Can I offer less than the asking price?',
        answer: (
          <p>
            Yes. Send an offer from the listing and the seller can accept, decline or counter it.
            Once a price is agreed you pay in the app, the same as buying at the asking price.
          </p>
        ),
      },
      {
        question: 'Can I ask the seller questions before I buy?',
        answer: (
          <p>
            Yes — message them from the listing. Conversations live in the Messages tab of your
            account, and you can archive any you're finished with.
          </p>
        ),
      },
    ],
  },
  {
    id: 'selling',
    title: 'Selling',
    entries: [
      {
        question: 'What does it cost to list something?',
        answer: (
          <p>
            Listing anything with a price costs a flat <strong>£{LISTING_FEE_GBP}</strong>, paid
            once when you publish, whatever the price. Free and donation listings, and club gear
            lots, aren't charged a posting fee. Relay occasionally runs promo codes — look out for
            the banner at the top of the site.
          </p>
        ),
      },
      {
        question: 'Why do I need to set up payouts before listing?',
        answer: (
          <p>
            Every priced item is paid for in the app, so before you can publish one you'll
            complete identity and bank verification with Stripe, our payment provider. It takes a
            few minutes and means that when your item sells, the money has somewhere to go. Free
            and donation listings don't need it.
          </p>
        ),
      },
      {
        question: 'Can I change a listing after it is live?',
        answer: (
          <p>
            Yes — edit it from the listing page any time until it sells. Once it's sold it's
            locked, because the buyer paid for what was described at the time.
          </p>
        ),
      },
      {
        question: 'What should my photos look like?',
        answer: (
          <p>
            Real photos of the actual item, clearly showing its condition and any wear. Photos
            mustn't contain people, including children — uploads are checked automatically and one
            that appears to show a person will be rejected.
          </p>
        ),
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments & fees',
    entries: [
      {
        question: 'Does a buyer pay anything on top of the listed price?',
        answer: (
          <p>
            Yes — a service fee of <strong>2% of the price plus 20p</strong>, shown as its own
            line at checkout before you pay (£20.20 on a £1,000 item). It covers payment
            processing and holding your payment until you confirm the item has arrived. Relay's
            commission is separate and comes out of the seller's side.
          </p>
        ),
      },
      {
        question: "What's Relay's commission?",
        answer: (
          <p>
            <strong>{PLATFORM_FEE_PERCENT}%</strong> of the sale price, capped at{' '}
            <strong>£{PLATFORM_FEE_CAP_GBP}</strong> so a large club gear lot doesn't pay an
            ever-growing cut. It's deducted from the seller's payout when the sale completes.
          </p>
        ),
      },
      {
        question: 'When does the seller get paid?',
        answer: (
          <>
            <p>
              Your payment is held in Relay's own Stripe account, not paid to the seller straight
              away. It's released when:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>you confirm the item has arrived (paid out immediately), or</li>
              <li>
                48 hours after the seller marks a courier delivery as delivered, if you haven't
                responded, or
              </li>
              <li>14 days at the latest, whichever comes first.</li>
            </ul>
            <p className="mt-2">
              Buyers get a reminder email on day 11, so nothing is released as a surprise.
            </p>
          </>
        ),
      },
      {
        question: 'Is my card information safe?',
        answer: (
          <p>
            Relay never sees or stores your card details — payment is handled entirely by Stripe.
          </p>
        ),
      },
      {
        question: 'Can I pay or be paid outside Relay?',
        answer: (
          <p>
            Please don't. The payment hold, confirm-receipt step and refund process only cover
            payments made through Relay's checkout — Relay can't help with money sent off-site.
          </p>
        ),
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery & collection',
    entries: [
      {
        question: 'How does the item get to me?',
        answer: (
          <p>
            Each seller offers either local collection or courier/parcel for a listing, and you
            see which at checkout. For courier delivery you enter your shipping address on the
            payment step; for collection there's no address, you arrange a pickup time with the
            seller directly. International buyers are responsible for any customs duties, import
            taxes or freight unless the listing says otherwise.
          </p>
        ),
      },
      {
        question: 'What should I do when it arrives?',
        answer: (
          <p>
            Check it against the listing, then confirm receipt from the Orders tab of your account
            — that releases the payment to the seller. If something's wrong, raise it{' '}
            <em>before</em> you confirm: once the money has gone to the seller, getting it back is
            harder.
          </p>
        ),
      },
    ],
  },
  {
    id: 'problems',
    title: 'Refunds & problems',
    entries: [
      {
        question: 'How do I ask for a refund?',
        answer: (
          <>
            <p>
              Open the order in your Orders tab and choose to request a refund, with a reason. The
              seller is emailed and can approve or decline it. Nothing is refunded until they
              approve. A refund returns everything you paid, including the service fee.
            </p>
            <p className="mt-2">
              If they decline and you think that's wrong, you can escalate to Relay, who review it
              and either issue the refund or reply with their reasoning. Relay doesn't guarantee an
              outcome, and these are mostly private sales between individuals, so be precise about
              condition before you pay.
            </p>
          </>
        ),
      },
      {
        question: 'How do I report a listing that looks unsafe or fake?',
        answer: (
          <p>
            Use <strong>Report this listing</strong> on the listing page — choose a reason and add
            details. Relay reviews reports and can remove listings, including stolen, counterfeit
            or recalled equipment.
          </p>
        ),
      },
    ],
  },
  {
    id: 'club-gear',
    title: 'Club gear',
    entries: [
      {
        question: 'What is club gear?',
        answer: (
          <p>
            A way for clubs and organisations to sell several pieces of kit together — a retired
            fleet, say — as one lot. Items can be bought individually or only as part of the lot,
            as the seller chooses. If a buyer wants a set of items at an agreed total, the seller
            sends them an invoice and the buyer pays it in the app like any other order. Club gear
            lots aren't charged the posting fee.
          </p>
        ),
      },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    entries: [
      {
        question: 'I forgot my password.',
        answer: (
          <p>
            Choose <strong>Sign in</strong>, then <strong>Forgot password?</strong> and enter your
            email — we'll send a link to set a new one.
          </p>
        ),
      },
      {
        question: 'Who can use Relay?',
        answer: (
          <p>
            Anyone aged 18 or over who can form a binding contract. One account per person. The
            full details are in the <Link to="/terms" className="underline hover:text-[var(--color-ink)]">Terms</Link>.
          </p>
        ),
      },
    ],
  },
  {
    id: 'tax',
    title: 'Tax, briefly',
    entries: [
      {
        question: 'Do I owe tax for selling my own kit?',
        answer: (
          <p>
            Selling something you bought for yourself — a chair you've outgrown, a handcycle
            you've upgraded from — is normally you disposing of a personal possession, not running
            a business, so there's usually nothing to report. A club retiring its own equipment is
            generally the same picture, though a club may have its own tax or VAT registrations
            worth checking with whoever does its accounts.
          </p>
        ),
      },
      {
        question: 'When does it count as trading?',
        answer: (
          <>
            <p>
              HMRC looks at the shape of the activity (its "badges of trade" test), not who the
              seller is. It points towards trading if you:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>buy items specifically to resell at a profit,</li>
              <li>do it repeatedly and regularly rather than as one-off disposals,</li>
              <li>recondition items to increase their resale value, or</li>
              <li>run it in an organised, business-like way.</li>
            </ul>
            <p className="mt-2">
              Even then, the first £1,000 of trading income in a tax year is covered by the
              trading allowance and needn't be reported.
            </p>
          </>
        ),
      },
      {
        question: 'Will Relay report my sales to HMRC?',
        answer: (
          <p>
            Online marketplaces must collect seller details and, for sellers over certain
            thresholds, report sales activity to HMRC. Being reported isn't the same as owing tax.
            The "private individual / non-profit club" or "commercial trader" choice when you list
            is what feeds this, so pick whichever honestly describes you — it doesn't change your
            fees.
          </p>
        ),
      },
      {
        question: 'What is VAT relief for disabled buyers?',
        answer: (
          <p>
            Some items designed solely for use by a disabled person can be sold VAT-free to a
            chronically sick or disabled buyer for their own personal use, under HMRC's disability
            relief. It only applies when the seller is a VAT-registered commercial trader. Those
            sellers can mark eligible items, and eligible buyers then make a written declaration at
            checkout, which is recorded on the order for the seller's VAT records. The price you
            pay is the listed price.
          </p>
        ),
      },
      {
        question: 'Where can I get a definitive answer for my situation?',
        answer: (
          <p>
            This is general information, not tax advice, and Relay can't assess individual
            circumstances. For anything beyond a clearly casual sale of your own kit, see{' '}
            <a
              href="https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-[var(--color-ink)]"
            >
              gov.uk's guidance on the trading allowance
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{' '}
            or speak to an accountant.
          </p>
        ),
      },
    ],
  },
];

function FaqItem({ entry }: { entry: FaqEntry }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
      <h3 className="text-base">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left font-medium"
        >
          <span>{entry.question}</span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`shrink-0 text-[var(--color-ink-soft)] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div
        id={panelId}
        hidden={!open}
        className="px-5 pb-5 text-sm leading-relaxed text-[var(--color-ink-soft)]"
      >
        {entry.answer}
      </div>
    </div>
  );
}

export function Faq() {
  const { hash } = useLocation();

  // React Router doesn't scroll to #anchors on its own, and /faq/tax now
  // redirects to /faq#tax.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        Help
      </p>
      <h1 className="text-4xl">Frequently asked questions</h1>
      <p className="mt-4 text-[15px] text-[var(--color-ink-soft)]">
        How buying, selling, payments and delivery work on Relay. For the formal wording see the{' '}
        <Link to="/terms" className="underline hover:text-[var(--color-ink)]">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/how-it-works" className="underline hover:text-[var(--color-ink)]">
          How it works
        </Link>
        .
      </p>

      <nav aria-label="FAQ sections" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-[var(--color-line)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-6">
            <h2 id={`${section.id}-heading`} className="mb-3 text-xl">
              {section.title}
            </h2>
            {section.id === 'tax' && <LegalDraftNotice />}
            <div className="space-y-3">
              {section.entries.map((entry) => (
                <FaqItem key={entry.question} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
