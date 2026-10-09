import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LegalDraftNotice } from '@/components/LegalDraftNotice';

// Deliberately not a blanket "you're exempt" claim — UK tax treatment turns
// on HMRC's "badges of trade" test (frequency, profit motive, whether items
// were bought to resell), not on who the seller is. Most casual sellers of
// their own outgrown kit genuinely have nothing to report, but that's
// because of how the activity looks under that test, not because Relay or
// this page can declare a category of seller tax-free. Content checked
// against gov.uk guidance current as of the "Last reviewed" date below —
// still not a substitute for an accountant or HMRC directly.
const FAQS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "Do I owe tax for selling my own equipment on Relay?",
    answer: (
      <p>
        Almost certainly not. Selling something you bought for yourself — a wheelchair you've
        outgrown, a handcycle you've upgraded from — is you disposing of your own personal
        possession, not running a business. That's not taxable income, however many times you've
        used it or however much you sell it for.
      </p>
    ),
  },
  {
    question: "What actually makes something count as \"trading\" instead?",
    answer: (
      <>
        <p>
          HMRC looks at the shape of the activity, not the seller's label — its "badges of trade"
          test. The things that point toward trading:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Buying items specifically to resell at a profit</li>
          <li>Doing it repeatedly and regularly, not as one-off disposals</li>
          <li>Modifying or reconditioning items to increase their resale value</li>
          <li>Running it in an organised, business-like way</li>
        </ul>
        <p className="mt-2">
          An occasional sale of kit you actually used yourself doesn't look like this, which is
          why it's treated as a personal disposal rather than trading.
        </p>
      </>
    ),
  },
  {
    question: "We're a club clearing out retired fleet equipment — is that different?",
    answer: (
      <p>
        A club disposing of its own equipment once it's retired from use is generally the same
        picture — getting rid of a capital asset the club no longer needs, not trading. That said,
        clubs can have their own structure-specific tax position (registered charity, CASC, or
        otherwise), so if your club has other tax or VAT registrations, it's worth a quick check
        with whoever handles the club's accounts rather than assuming this page covers your exact
        setup.
      </p>
    ),
  },
  {
    question: "What's the £1,000 trading allowance?",
    answer: (
      <p>
        If your selling activity does tip into "trading" under the test above, the first £1,000 of
        trading income in a tax year is tax-free automatically — no need to register or report
        anything. Only income over that threshold needs declaring via Self Assessment.
      </p>
    ),
  },
  {
    question: "Will Relay report my sales to HMRC?",
    answer: (
      <p>
        Online marketplaces are required by HMRC's digital platform reporting rules to collect
        seller information and, for sellers who pass certain thresholds in a year, report their
        sales activity. Being reported isn't the same as owing tax — it's Relay sharing data, not
        a judgement on your tax position. The "private individual" vs. "commercial trader" choice
        when you list is what feeds that reporting, so pick whichever honestly describes you.
      </p>
    ),
  },
  {
    question: "Where can I get a definitive answer for my own situation?",
    answer: (
      <p>
        This page is general information, not tax advice, and Relay isn't able to assess your
        individual circumstances. For anything beyond a clearly casual, one-off sale of your own
        kit, check{' '}
        <a
          href="https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-work-out-your-rental-income#trading-and-property-allowances"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-[var(--color-ink)]"
        >
          gov.uk
        </a>{' '}
        or speak to an accountant.
      </p>
    ),
  },
];

function FaqItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="font-medium">{question}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[var(--color-ink-soft)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          {answer}
        </div>
      )}
    </div>
  );
}

export function TaxFaq() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        Selling on Relay
      </p>
      <h1 className="text-4xl">Tax questions, answered plainly</h1>
      <p className="mt-4 text-[15px] text-[var(--color-ink-soft)]">
        Most people selling their own outgrown or retired kit on Relay — individual parathletes
        and clubs clearing a fleet alike — have nothing to report. Here's why, and where the line
        actually sits.
      </p>

      <div className="mt-8">
        <LegalDraftNotice />
      </div>

      <div className="space-y-3">
        {FAQS.map((f) => (
          <FaqItem key={f.question} question={f.question} answer={f.answer} />
        ))}
      </div>

      <p className="mt-8 text-xs text-[var(--color-ink-soft)]">Last reviewed: draft, unpublished.</p>
    </div>
  );
}
