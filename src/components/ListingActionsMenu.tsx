import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Boxes, Eye, Info, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Listing } from '@/types';
import { formatDateTime, formatPrice } from '@/lib/format';

/**
 * The "..." menu on a My-listings card. Consolidates what used to be spread
 * across separate pages (Edit/Delete only lived on the listing's own detail
 * page) into one place, and adapts its items to the listing's own state
 * rather than showing actions that would just error — e.g. a sold listing
 * can't be edited or deleted, only archived; a bundle member is managed
 * from its lot, not here.
 */
export function ListingActionsMenu({
  listing,
  isArchived,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  listing: Listing;
  isArchived: boolean;
  onArchive: (listingId: string) => void;
  onUnarchive: (listingId: string) => void;
  onDelete: (listingId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowInfo(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isSold = !!listing.soldAt;
  const isBundleItem = !!listing.bundleId;
  const canEdit = !isSold && !isBundleItem && listing.feeStatus !== 'pending';
  const canDelete = !isSold && !isBundleItem;
  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-paper)]';

  return (
    <div ref={menuRef} className="absolute right-3 bottom-3 z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Listing actions"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[var(--color-ink-soft)] shadow-sm hover:text-[var(--color-ink)]"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] py-1 text-sm shadow-lg">
          <Link to={`/listing/${listing.id}`} className={itemClass} onClick={() => setOpen(false)}>
            <Eye size={14} /> View
          </Link>
          <button onClick={() => setShowInfo((v) => !v)} className={itemClass}>
            <Info size={14} /> Info
          </button>
          {showInfo && (
            <div className="space-y-1 border-y border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
              <p>Listed {formatDateTime(listing.postedAt)}</p>
              <p>
                {formatPrice(listing.price, listing.currency)} · {listing.condition}
              </p>
              <p>
                {listing.location}, {listing.country}
              </p>
              {isSold && listing.soldAt && (
                <p className="font-medium text-[var(--color-ink)]">Sold {formatDateTime(listing.soldAt)}</p>
              )}
              {!isSold && listing.feeStatus === 'pending' && (
                <p className="font-medium text-[var(--color-brand-dark)]">Listing fee payment pending</p>
              )}
            </div>
          )}
          {isBundleItem ? (
            <Link
              to={`/club-gear/${listing.bundleId}`}
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <Boxes size={14} /> Manage lot
            </Link>
          ) : (
            canEdit && (
              <Link to={`/sell?edit=${listing.id}`} className={itemClass} onClick={() => setOpen(false)}>
                <Pencil size={14} /> Edit
              </Link>
            )
          )}
          {isSold &&
            (isArchived ? (
              <button
                onClick={() => {
                  setOpen(false);
                  onUnarchive(listing.id);
                }}
                className={itemClass}
              >
                <ArchiveRestore size={14} /> Unarchive
              </button>
            ) : (
              <button
                onClick={() => {
                  setOpen(false);
                  onArchive(listing.id);
                }}
                className={itemClass}
              >
                <Archive size={14} /> Archive
              </button>
            ))}
          {canDelete && (
            <button
              onClick={() => {
                setOpen(false);
                onDelete(listing.id);
              }}
              className={`${itemClass} text-[var(--color-brand-dark)]`}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
