import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Star, Loader2, MessageSquareText } from 'lucide-react';
import { listings as demoListings } from '@/data/listings';
import { fetchListingsBySeller, fetchReviewsForSeller, type Review } from '@/lib/supabaseData';
import { ListingCard } from '@/components/ListingCard';
import { Avatar } from '@/components/Avatar';
import { timeAgo } from '@/lib/format';
import type { Listing } from '@/types';

const isDemoSellerId = (id: string) => /^s\d+$/.test(id);

export function SellerProfile() {
  const { id } = useParams();
  const [sellerListings, setSellerListings] = useState<Listing[] | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    if (!id) return;
    if (isDemoSellerId(id)) {
      setSellerListings(demoListings.filter((l) => l.seller.id === id));
      setReviews([]);
      return;
    }
    fetchListingsBySeller(id).then(setSellerListings);
    fetchReviewsForSeller(id).then(setReviews);
  }, [id]);

  if (sellerListings === null) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      </div>
    );
  }

  const seller = sellerListings[0]?.seller;

  if (!seller) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-[var(--color-ink-soft)]">
          This seller hasn't published any listings yet.
        </p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-brand)] underline">
          Back to browse
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={15} /> Back to browse
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={seller.name} avatarUrl={seller.avatarUrl} className="h-16 w-16 text-2xl" />
        <div>
          <div className="flex items-center gap-1.5 text-2xl">
            {seller.name}
            {seller.verified && <BadgeCheck size={18} className="text-[var(--color-moss)]" />}
          </div>
          <p className="text-sm text-[var(--color-ink-soft)]">
            {seller.club ? `${seller.club} · ` : ''}Member since {seller.memberSince}
          </p>
          <div className="mt-1 flex items-center gap-3 text-sm text-[var(--color-ink-soft)]">
            <span className="flex items-center gap-1">
              <Star size={13} className="fill-[var(--color-brand)] text-[var(--color-brand)]" />
              {seller.rating.toFixed(1)}
            </span>
            <span>{seller.salesCount} completed sale{seller.salesCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <h2 className="mb-4 mt-10 text-lg">
        {seller.name.split(' ')[0]}'s listings ({sellerListings.length})
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sellerListings.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>

      <h2 className="mb-4 mt-12 flex items-center gap-2 text-lg">
        <MessageSquareText size={17} /> Reviews {reviews && reviews.length > 0 && `(${reviews.length})`}
      </h2>
      {reviews === null ? (
        <Loader2 className="animate-spin text-[var(--color-ink-soft)]" />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">No reviews yet.</p>
      ) : (
        <div className="max-w-2xl space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={13}
                      className={
                        n <= r.rating
                          ? 'fill-[var(--color-brand)] text-[var(--color-brand)]'
                          : 'text-[var(--color-line)]'
                      }
                    />
                  ))}
                </div>
                <span className="text-xs text-[var(--color-ink-soft)]">{timeAgo(r.createdAt.slice(0, 10))}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm text-[var(--color-ink)]">{r.comment}</p>}
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">— {r.reviewerName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
