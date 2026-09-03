/** Shows the uploaded profile picture if there is one, else the existing initial-letter circle. */
export function Avatar({
  name,
  avatarUrl,
  className = 'h-11 w-11',
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] font-display text-[var(--color-brand-dark)]`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
