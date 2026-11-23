import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { FitProfile } from '@/types';

// Bump these when the wording of the Terms / Privacy Policy changes in a way
// that matters, and shown dates follow. Each consent row records the version
// the person actually saw.
export const TERMS_VERSION = '2026-11-23';
export const PRIVACY_VERSION = '2026-11-23';

export type ConsentPurpose = 'terms' | 'fit_profile';

/**
 * Fit-profile fields that can reveal health or disability (special category
 * data under UK GDPR), so need explicit consent. Height, weight and seat
 * measurements don't.
 */
export function hasSensitiveFitData(p: FitProfile): boolean {
  return !!(p.classification.trim() || p.disabilityNotes.trim() || p.notes.trim());
}

export async function recordConsent(
  purpose: ConsentPurpose,
  version: string,
  source: string,
  givenAt?: string,
): Promise<void> {
  const { error } = await supabase.rpc('record_consent', {
    p_purpose: purpose,
    p_version: version,
    p_source: source,
    p_given_at: givenAt ?? null,
  });
  if (error) throw error;
}

export async function withdrawConsent(purpose: ConsentPurpose): Promise<void> {
  const { error } = await supabase.rpc('withdraw_consent', { p_purpose: purpose });
  if (error) throw error;
}

/** When the person's live consent for this purpose was given, or null if none. */
export async function fetchActiveConsentDate(
  userId: string,
  purpose: ConsentPurpose,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_consents')
    .select('given_at')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as { given_at: string } | null)?.given_at ?? null;
}

// Google sign-in leaves the app and comes back, so the "I agree" the person
// gave beforehand is parked here until there's a session to record it against.
const PENDING_TERMS_KEY = 'relay-pending-terms';

export interface PendingTerms {
  version: string;
  source: string;
  at: string;
}

export function stashPendingTerms(source: string): void {
  try {
    const pending: PendingTerms = { version: TERMS_VERSION, source, at: new Date().toISOString() };
    localStorage.setItem(PENDING_TERMS_KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable — the Terms acceptance just won't be recorded for this sign-in */
  }
}

export function takePendingTerms(): PendingTerms | null {
  try {
    const raw = localStorage.getItem(PENDING_TERMS_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_TERMS_KEY);
    const parsed = JSON.parse(raw) as PendingTerms;
    return parsed?.version && parsed?.at ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Records the Terms acceptance given at sign-up, once there is a session to
 * record it against: from the Google round-trip stash, or from the metadata an
 * email sign-up carried (it may only be signed in after confirming by email).
 * Accounts that predate this have no evidence of acceptance, so none is invented.
 */
export async function recordTermsForUser(user: User): Promise<void> {
  const doneKey = `relay-terms-recorded-${user.id}`;
  try {
    if (localStorage.getItem(doneKey)) return;
  } catch {
    /* ignore */
  }

  const pending = takePendingTerms();
  const meta = user.user_metadata as { terms_version?: string; terms_accepted_at?: string } | undefined;
  const evidence = pending
    ? { version: pending.version, source: pending.source, at: pending.at }
    : meta?.terms_version
      ? { version: meta.terms_version, source: 'signup_email', at: meta.terms_accepted_at }
      : null;
  if (!evidence) return;

  try {
    await recordConsent('terms', evidence.version, evidence.source, evidence.at);
    localStorage.setItem(doneKey, '1');
  } catch (err) {
    console.error('Could not record Terms acceptance', err);
    // Put a Google-flow stash back so the next load tries again.
    if (pending) {
      try {
        localStorage.setItem(PENDING_TERMS_KEY, JSON.stringify(pending));
      } catch {
        /* ignore */
      }
    }
  }
}
