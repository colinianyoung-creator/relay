import { Link } from 'react-router-dom';
import { Mail, MessageSquarePlus, PackagePlus } from 'lucide-react';
import { useFeedback } from '@/lib/feedbackContext';

export function About() {
  const { openFeedback } = useFeedback();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
        About
      </p>

      <div className="grid gap-8 sm:grid-cols-[1fr_15rem] sm:items-start">
        <div className="sm:order-1">
          <h1 className="text-4xl">Hi, I'm Colin.</h1>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
            <p>
              I'm the founder of Relay. I have cerebral palsy, and I've played competitive sport
              since my teens, mostly athletics and boccia, including at the National Junior Games
              at Stoke Mandeville.
            </p>
            <p>
              Anyone in disability sport knows the right kit makes a difference. It's also
              expensive, sized to one person, and when you outgrow it, usually passed on through
              Facebook groups and word of mouth.
            </p>
            <p>
              Relay is my attempt to give that a proper home: a searchable marketplace where
              clubs, families and athletes can list equipment, check it will fit, and pay safely,
              with the money held until the buyer confirms the kit has arrived.
            </p>
            <p>
              Relay is new and still in development, so things will change and I'll get some
              things wrong. I read every piece of feedback, and clubs and athletes are shaping what
              it becomes.
            </p>
          </div>
        </div>

        <img
          src="/about-colin.jpg"
          alt="Colin, the founder of Relay, smiling"
          width={800}
          height={1000}
          className="order-first mx-auto w-40 rounded-2xl object-cover sm:order-2 sm:w-full"
        />
      </div>

      <h2 className="mt-12 text-2xl">Get involved</h2>
      <p className="mt-3 text-[15px] text-[var(--color-ink-soft)]">
        If you're part of a club or governing body, or you have kit to pass on, I'd love to hear
        from you.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          to="/sell"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-dark)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-darker)]"
        >
          <PackagePlus size={16} aria-hidden="true" /> List your equipment
        </Link>
        <button
          type="button"
          onClick={openFeedback}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-ink)]"
        >
          <MessageSquarePlus size={16} aria-hidden="true" /> Send feedback
        </button>
        <a
          href="mailto:help@relayadaptive.com"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-ink)]"
        >
          <Mail size={16} aria-hidden="true" /> help@relayadaptive.com
        </a>
      </div>
    </div>
  );
}
