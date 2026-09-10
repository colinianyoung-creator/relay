import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Star,
  MessageCircle,
  Globe2,
  Loader2,
  Ruler,
  CheckCircle2,
} from 'lucide-react';
import {
  fetchWantedPost,
  hasMessagedWanted,
  sendMessageToWanted,
  markWantedStatus,
  fetchMatchingListings,
} from '@/lib/supabaseData';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/Badge';
import { AuthModal } from '@/components/AuthModal';
import { ListingPhoto } from '@/components/ListingPhoto';
import { Avatar } from '@/components/Avatar';
import { formatPrice, timeAgo } from '@/lib/format';
import type { WantedPost, Listing } from '@/types';

const STRUCTURED_SPEC_LABELS: { key: keyof WantedPost; label: string; unit: string }[] = [
  { key: 'seatWidthCm', label: 'Seat width', unit: 'cm' },
  { key: 'seatDepthCm', label: 'Seat depth', unit: 'cm' },
  { key: 'minUserHeightCm', label: 'Min. user height', unit: 'cm' },
  { key: 'maxUserHeightCm', label: 'Max. user height', unit: 'cm' },
  { key: 'minUserWeightKg', label: 'Min. user weight', unit: 'kg' },
  { key: 'maxUserWeightKg', label: 'Max. user weight', unit: 'kg' },
];

export function WantedDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  // Mirrors `user` so a resumed post-login action (see requireAuth) always
  // reads the current session, not the stale one captured when it was queued.
  const userRef = useRef(user);
  userRef.current = user;
  const [post, setPost] = useState<WantedPost | null | undefined>(undefined);
  const [messageSent, setMessageSent] = useState(false);
  const [message, setMessage] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [matches, setMatches] = useState<Listing[] | null>(null);

  // Runs a queued requireAuth() action once `user` actually reflects the new
  // session — not from AuthModal's success callback directly, since that can
  // fire before React has committed the updated auth state.
  useEffect(() => {
    if (!user || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action();
  }, [user]);

  useEffect(() => {
    if (!id) return;
    fetchWantedPost(id)
      .then(setPost)
      .catch(() => setPost(null));
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    hasMessagedWanted(id, user.id).then(setMessageSent);
  }, [id, user]);

  useEffect(() => {
    if (!post || !user || user.id !== post.buyer.id) return;
    fetchMatchingListings(post).then(setMatches);
  }, [post, user]);

  if (post === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-[var(--color-ink-soft)]">Wanted post not found.</p>
        <Link to="/wanted" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to wanted board
        </Link>
      </div>
    );
  }

  const structuredSpecs = STRUCTURED_SPEC_LABELS.filter(
    ({ key }) => typeof post[key] === 'number',
  );
  const isOwner = user?.id === post.buyer.id;

  function requireAuth(action: () => void) {
    if (!user) {
      pendingActionRef.current = action;
      setShowAuth(true);
      return;
    }
    action();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/wanted"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={15} /> Back to wanted board
      </Link>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <ListingPhoto sport={post.sport} className="h-56 w-full rounded-2xl opacity-80 sm:h-64" />

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>{post.category}</Badge>
            {post.status === 'fulfilled' && <Badge tone="moss">Found</Badge>}
            {post.openToInternational && (
              <Badge>
                <Globe2 size={11} /> Open to shipping
              </Badge>
            )}
          </div>

          <h1 className="mt-4 text-3xl leading-tight sm:text-4xl">{post.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--color-ink-soft)]">
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {post.country}
            </span>
            <span>·</span>
            <span>Posted {timeAgo(post.createdAt.slice(0, 10))}</span>
          </div>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink)]">
            {post.description}
          </p>

          {structuredSpecs.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg">
                <Ruler size={17} /> What they need
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 sm:grid-cols-3">
                {structuredSpecs.map(({ key, label, unit }) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {post[key] as number}
                      {unit}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
            <span className="font-display text-2xl">
              {post.maxPrice ? `Up to ${formatPrice(post.maxPrice, post.currency)}` : 'Any budget'}
            </span>

            <div className="mt-5 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
              <Avatar name={post.buyer.name} avatarUrl={post.buyer.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-medium">
                  {post.buyer.name}
                  {post.buyer.verified && (
                    <BadgeCheck size={14} className="text-[var(--color-moss)]" />
                  )}
                </div>
                <div className="truncate text-xs text-[var(--color-ink-soft)]">
                  {post.buyer.club ?? `Member since ${post.buyer.memberSince}`}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-ink-soft)]">
              <span className="flex items-center gap-1">
                <Star size={12} className="fill-[var(--color-brand)] text-[var(--color-brand)]" />
                {post.buyer.rating.toFixed(1)}
              </span>
            </div>

            {isOwner ? (
              <div className="mt-5">
                <p className="rounded-xl bg-[var(--color-line)]/40 p-4 text-sm text-[var(--color-ink-soft)]">
                  This is your wanted post.
                </p>

                {matches === null ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                    <Loader2 size={12} className="animate-spin" /> Checking current listings…
                  </p>
                ) : matches.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-medium text-[var(--color-brand-dark)]">
                      {matches.length} listing{matches.length === 1 ? '' : 's'} might already match
                    </p>
                    <div className="space-y-2">
                      {matches.map((l) => (
                        <Link
                          key={l.id}
                          to={`/listing/${l.id}`}
                          className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm hover:border-[var(--color-brand)]"
                        >
                          <span className="font-medium">{l.title}</span>
                          <span className="text-xs text-[var(--color-ink-soft)]">
                            {formatPrice(l.price, l.currency)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                    No matching listings right now — you'll see it here on this page if that
                    changes.
                  </p>
                )}

                {post.status === 'open' ? (
                  <button
                    onClick={async () => {
                      await markWantedStatus(post.id, 'fulfilled');
                      setPost({ ...post, status: 'fulfilled' });
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-moss)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    <CheckCircle2 size={16} /> Mark as found
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await markWantedStatus(post.id, 'open');
                      setPost({ ...post, status: 'open' });
                    }}
                    className="mt-3 w-full rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
                  >
                    Reopen — still looking
                  </button>
                )}
              </div>
            ) : messageSent ? (
              <div className="mt-5 rounded-xl bg-[var(--color-moss-soft)] p-4 text-sm text-[var(--color-moss)]">
                Message sent — {post.buyer.name.split(' ')[0]} will see it in their messages.
              </div>
            ) : (
              <div className="mt-5">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hi ${post.buyer.name.split(' ')[0]}, I've got a ${post.category.toLowerCase()} that might work for this...`}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
                <button
                  onClick={() =>
                    requireAuth(async () => {
                      if (!userRef.current) return;
                      await sendMessageToWanted(post.id, userRef.current.id, message);
                      setMessageSent(true);
                    })
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
                >
                  <MessageCircle size={16} /> I've got one of these
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-[var(--color-ink-soft)]">
              Relay doesn't handle payment — buyers and sellers arrange this directly.
            </p>
          </div>
        </aside>
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => {
            pendingActionRef.current = null;
            setShowAuth(false);
          }}
          onAuthenticated={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
