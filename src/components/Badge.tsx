import type { ReactNode } from 'react';

const tones = {
  neutral: 'bg-[var(--color-line)]/60 text-[var(--color-ink-soft)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]',
  moss: 'bg-[var(--color-moss-soft)] text-[var(--color-moss)]',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
