import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { countActionItems, fetchActionItems, type ActionItem } from '@/lib/actionItems';
import { ActionItemsContext } from '@/lib/actionItemsContext';

// Navigation and tab-focus re-checks are skipped if one just ran; the timer
// below keeps a long-open tab honest.
const MIN_GAP_MS = 15_000;
const POLL_MS = 60_000;

export function ActionItemsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const userId = user?.id ?? null;
  const isAdmin = !!profile?.is_admin;

  // Tagged with whose items they are, so a previous user's list can never
  // show for whoever signs in next while the first fetch is still running.
  const [state, setState] = useState<{ forUser: string | null; items: ActionItem[] }>({ forUser: null, items: [] });
  const inFlight = useRef(false);
  const rerun = useRef(false);
  const lastRun = useRef(0);
  const currentUser = useRef(userId);
  useEffect(() => {
    currentUser.current = userId;
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    // Calls that arrive mid-fetch collapse into one follow-up fetch.
    if (inFlight.current) {
      rerun.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        rerun.current = false;
        const next = await fetchActionItems(userId, isAdmin);
        lastRun.current = Date.now();
        // Ignore a result that arrives after signing out or switching account.
        if (currentUser.current === userId) setState({ forUser: userId, items: next });
      } while (rerun.current);
    } catch {
      // Keep showing the last known items — a failed check shouldn't blank
      // the badge or surface an error nobody asked for.
    } finally {
      inFlight.current = false;
    }
  }, [userId, isAdmin]);

  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastRun.current > MIN_GAP_MS) void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    refreshIfStale();
  }, [location.pathname, refreshIfStale]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, POLL_MS);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [userId, refreshIfStale]);

  // Stable identity (changes only with the user) so a component can safely
  // list it in an effect's dependencies without re-running on every refresh.
  const requestRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => {
    const visible = userId && state.forUser === userId ? state.items : [];
    return { items: visible, count: countActionItems(visible), refresh: requestRefresh };
  }, [state, userId, requestRefresh]);

  return <ActionItemsContext.Provider value={value}>{children}</ActionItemsContext.Provider>;
}
