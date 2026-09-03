import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, MapPin, Globe2 } from 'lucide-react';
import { fetchWantedPosts } from '@/lib/supabaseData';
import { SPORTS, type Sport, type WantedPost } from '@/types';
import { ListingPhoto } from '@/components/ListingPhoto';
import { Badge } from '@/components/Badge';
import { formatPrice, timeAgo, countryCode } from '@/lib/format';

export function WantedBoard() {
  const [posts, setPosts] = useState<WantedPost[] | null>(null);
  const [sport, setSport] = useState<Sport | 'all'>('all');

  useEffect(() => {
    fetchWantedPosts().then(setPosts);
  }, []);

  const filtered = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => (sport === 'all' ? true : p.sport === sport));
  }, [posts, sport]);

  return (
    <div>
      <section className="border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-brand)]">
            Wanted board
          </p>
          <h1 className="max-w-2xl text-4xl leading-[1.08] sm:text-5xl">
            Post what you're after — let it come to you.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-[var(--color-ink-soft)]">
            Not everything gets listed the week you need it. Post your size and budget, and
            sellers with matching kit — including gear that hasn't outgrown its owner yet —
            can find you directly.
          </p>
          <Link
            to="/wanted/new"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
          >
            <Plus size={16} /> Post what you need
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport | 'all')}
            className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3.5 py-1.5 text-sm"
          >
            <option value="all">All sports</option>
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
            {posts === null && <Loader2 size={13} className="animate-spin" />}
            {filtered.length} wanted post{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {posts !== null && filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-20 text-center text-[var(--color-ink-soft)]">
            Nobody's posted a want for this yet — be the first.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => (
              <Link
                key={post.id}
                to={`/wanted/${post.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(27,26,23,0.18)]"
              >
                <div className="relative">
                  <ListingPhoto sport={post.sport} className="h-32 w-full opacity-80" />
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] shadow-sm">
                    {post.maxPrice ? `Up to ${formatPrice(post.maxPrice, post.currency)}` : 'Any budget'}
                  </span>
                  {post.status === 'fulfilled' && (
                    <span className="absolute left-3 top-3 rounded-full bg-[var(--color-moss)] px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                      Found
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <h3 className="font-display text-base leading-snug text-[var(--color-ink)]">
                    {post.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{post.category}</Badge>
                    {post.openToInternational && (
                      <Badge>
                        <Globe2 size={11} /> Open to shipping
                      </Badge>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-[var(--color-ink-soft)]">
                    <span className="flex items-center gap-1">
                      <MapPin size={13} /> {countryCode(post.country)}
                    </span>
                    <span>{timeAgo(post.createdAt.slice(0, 10))}</span>
                  </div>
                  <div className="text-xs font-medium text-[var(--color-ink-soft)]">
                    {post.buyer.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
