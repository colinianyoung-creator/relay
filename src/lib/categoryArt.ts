import type { Sport } from '@/types';
import {
  Dumbbell,
  Zap,
  Target,
  Bike,
  Waves,
  CircleDot,
  Wind,
  Package,
  type LucideIcon,
} from 'lucide-react';

interface Art {
  icon: LucideIcon;
  gradient: string;
}

export const categoryArt: Record<Sport, Art> = {
  basketball: { icon: Dumbbell, gradient: 'from-[#ff4d2e] to-[#ff8f68]' },
  rugby: { icon: Zap, gradient: 'from-[#16b364] to-[#7de3ab]' },
  racing: { icon: Wind, gradient: 'from-[#2f5df0] to-[#8fadff]' },
  handcycling: { icon: Bike, gradient: 'from-[#ff9500] to-[#ffc266]' },
  boccia: { icon: Target, gradient: 'from-[#7c3aed] to-[#c4a6f7]' },
  swimming: { icon: Waves, gradient: 'from-[#06b6d4] to-[#7ce8f5]' },
  tennis: { icon: CircleDot, gradient: 'from-[#ca8a04] to-[#fde047]' },
  other: { icon: Package, gradient: 'from-[#475569] to-[#94a3b8]' },
};
