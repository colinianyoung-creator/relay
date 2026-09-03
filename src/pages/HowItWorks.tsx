import { Link } from 'react-router-dom';
import { Search, MessageCircle, Handshake, HeartHandshake } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Search by fit, not just photos',
    body: 'Filter by sport, seat width, camber, frame size and condition — built for equipment that has to actually fit, not just look right in a thumbnail.',
  },
  {
    icon: MessageCircle,
    title: 'Message the seller directly',
    body: "No middleman, no bidding war. Ask your questions, agree a price, and arrange a viewing — same as you would with any private sale.",
  },
  {
    icon: Handshake,
    title: 'Pay securely, or arrange it yourselves',
    body: "If a seller's set up payouts, you can pay in-app via Stripe — Relay never sees your card details or holds your money itself. Otherwise, agree payment and collection directly, same as any private sale.",
  },
];

export function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        How Relay works
      </p>
      <h1 className="text-4xl">A better home for kit that's outgrown its owner.</h1>
      <p className="mt-4 text-[15px] text-[var(--color-ink-soft)]">
        Sports wheelchairs, handcycles and running blades are expensive, sized to the athlete,
        and traded today mostly through Facebook groups and word of mouth. Relay is a
        dedicated, searchable home for that — free to list, free to browse.
      </p>

      <div className="mt-12 space-y-8">
        {steps.map((step, i) => (
          <div key={step.title} className="flex gap-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
              <step.icon size={19} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                Step {i + 1}
              </p>
              <h2 className="mt-1 text-lg">{step.title}</h2>
              <p className="mt-1 text-[15px] text-[var(--color-ink-soft)]">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 flex items-start gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
        <HeartHandshake size={28} className="shrink-0 text-[var(--color-moss)]" />
        <div>
          <h2 className="text-lg">Built with clubs, not just for them</h2>
          <p className="mt-1 text-[15px] text-[var(--color-ink-soft)]">
            Relay grew out of watching clubs trade kit informally through Facebook groups.
            We'd love to partner with your club or governing body to help members list
            outgrown or spare equipment properly — get in touch.
          </p>
        </div>
      </div>

      <Link
        to="/"
        className="mt-10 inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
      >
        Browse equipment
      </Link>
    </div>
  );
}
