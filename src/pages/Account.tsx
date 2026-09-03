import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, MessageCircle, PackagePlus, Loader2, Search, Camera } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  fetchListingsBySeller,
  fetchSavedListings,
  fetchSentMessages,
  fetchWantedPostsByBuyer,
  fetchSentWantedMessages,
  uploadAvatar,
  type MessageThread,
  type WantedMessageThread,
} from '@/lib/supabaseData';
import { ListingCard } from '@/components/ListingCard';
import { FitProfileForm } from '@/components/FitProfileForm';
import { PayoutsPanel } from '@/components/PayoutsPanel';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { formatPrice, timeAgo } from '@/lib/format';
import type { Listing, WantedPost } from '@/types';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

const TABS = ['My listings', 'Saved', 'Wanted posts', 'Messages', 'Payouts', 'Fit profile'] as const;

type UnifiedMessage =
  | ({ kind: 'listing' } & MessageThread)
  | ({ kind: 'wanted' } & WantedMessageThread);

export function Account() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>(
    searchParams.get('tab') === 'payouts' ? 'Payouts' : 'My listings',
  );
  const [myListings, setMyListings] = useState<Listing[] | null>(null);
  const [saved, setSaved] = useState<Listing[] | null>(null);
  const [wantedPosts, setWantedPosts] = useState<WantedPost[] | null>(null);
  const [messages, setMessages] = useState<UnifiedMessage[] | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await uploadAvatar(user.id, file);
      await refreshProfile();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not upload that picture.');
    } finally {
      setAvatarUploading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchListingsBySeller(user.id).then(setMyListings);
    fetchSavedListings(user.id).then(setSaved);
    fetchWantedPostsByBuyer(user.id).then(setWantedPosts);
    Promise.all([fetchSentMessages(user.id), fetchSentWantedMessages(user.id)]).then(
      ([listingMsgs, wantedMsgs]) => {
        const unified: UnifiedMessage[] = [
          ...listingMsgs.map((m) => ({ kind: 'listing' as const, ...m })),
          ...wantedMsgs.map((m) => ({ kind: 'wanted' as const, ...m })),
        ].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        setMessages(unified);
      },
    );
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center gap-4">
        <button
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          aria-label="Change profile picture"
          className="group relative h-14 w-14 shrink-0 rounded-full disabled:opacity-70"
        >
          <Avatar name={profile?.name ?? user.email ?? '?'} avatarUrl={profile?.avatar_url} className="h-14 w-14 text-xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition group-hover:bg-black/40 group-hover:text-white">
            {avatarUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </button>
        <div>
          <div className="flex items-center gap-1.5 text-xl font-medium">
            {profile?.name ?? user.email}{' '}
            {profile?.verified && <BadgeCheck size={16} className="text-[var(--color-moss)]" />}
          </div>
          <p className="text-sm text-[var(--color-ink-soft)]">
            {profile?.club ? `${profile.club}` : user.email}
          </p>
          {avatarError && <p className="mt-1 text-xs text-[var(--color-brand-dark)]">{avatarError}</p>}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-6 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${
              tab === t
                ? 'border-[var(--color-brand)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t}
            {t === 'Messages' && messages && messages.length > 0 && (
              <span className="ml-1.5 text-[var(--color-brand)]">({messages.length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'My listings' &&
          (myListings === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : myListings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              <PackagePlus size={28} />
              <p>You haven't listed anything yet.</p>
              <Link
                to="/sell"
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                List equipment
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {myListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ))}

        {tab === 'Saved' &&
          (saved === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : saved.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              Nothing saved yet — tap the heart on a real listing to keep it here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ))}

        {tab === 'Wanted posts' &&
          (wantedPosts === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : wantedPosts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              <Search size={28} />
              <p>You haven't posted a want yet.</p>
              <Link
                to="/wanted/new"
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Post what you need
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
              {wantedPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/wanted/${post.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--color-paper)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{post.title}</span>
                      <Badge tone={post.status === 'fulfilled' ? 'moss' : 'brand'}>
                        {post.status === 'fulfilled' ? 'Found' : 'Open'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                      {post.maxPrice
                        ? `Up to ${formatPrice(post.maxPrice, post.currency)}`
                        : 'Any budget'}{' '}
                      · posted {timeAgo(post.createdAt.slice(0, 10))}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ))}

        {tab === 'Messages' &&
          (messages === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
              No messages sent yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
              {messages.map((msg) => (
                <div
                  key={(msg.kind === 'listing' ? msg.listingId : msg.wantedId) + msg.sentAt}
                  className="flex items-center gap-4 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
                    <MessageCircle size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {msg.kind === 'listing'
                          ? 'You messaged about this listing'
                          : "You offered kit for this wanted post"}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                        {timeAgo(msg.sentAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="truncate text-sm text-[var(--color-ink-soft)]">
                      {msg.body || '(no message text)'}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]/80">
                      Re:{' '}
                      {msg.kind === 'listing' ? (
                        <>
                          {msg.listingTitle} · {formatPrice(msg.listingPrice, msg.listingCurrency)}
                        </>
                      ) : (
                        <>
                          {msg.wantedTitle}
                          {msg.wantedMaxPrice
                            ? ` · up to ${formatPrice(msg.wantedMaxPrice, msg.wantedCurrency)}`
                            : ''}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === 'Payouts' && <PayoutsPanel />}

        {tab === 'Fit profile' && <FitProfileForm userId={user.id} />}
      </div>
    </div>
  );
}
