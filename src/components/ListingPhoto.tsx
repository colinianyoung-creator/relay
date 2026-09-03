import type { Sport } from '@/types';
import { categoryArt } from '@/lib/categoryArt';

export function ListingPhoto({ sport, className = '' }: { sport: Sport; className?: string }) {
  const { icon: Icon, gradient } = categoryArt[sport];
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_30%_20%,white,transparent_45%)]" />
      <Icon className="text-white/90" strokeWidth={1.25} size={56} />
    </div>
  );
}
