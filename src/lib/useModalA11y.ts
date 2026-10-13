import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared keyboard/focus behaviour for the app's portal-rendered modals
 * (AuthModal, MakeOfferModal, MySizeModal, ReportListingModal,
 * RequestRefundModal, EditClubGearItemModal) — all six share the same
 * fixed-overlay + card structure, so this is one place to get Escape-to-close
 * and a focus trap right instead of six copies.
 *
 * Moves focus into the modal on open, restores it to whatever was focused
 * before on close, traps Tab/Shift+Tab inside the modal, and closes on
 * Escape.
 */
export function useModalA11y(onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? container).focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
    // onClose intentionally omitted — re-running this on every render would
    // re-steal focus and re-fire the "previously focused" capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return containerRef;
}
