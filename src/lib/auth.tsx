import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { TERMS_VERSION, recordTermsForUser, stashPendingTerms, takePendingTerms } from '@/lib/consent';

export interface Profile {
  id: string;
  name: string;
  club: string | null;
  verified: boolean;
  rating: number;
  sales_count: number;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean;
  is_admin: boolean;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    club: string,
  ) => Promise<{ error: string | null; signedIn: boolean }>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      // Awaited, not fired-and-forgotten: `loading` needs to cover the profile
      // fetch too, or a page gating on a profile field (e.g. is_admin) can
      // redirect away in the gap between session resolving and profile
      // arriving, before ever seeing the real value.
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, name: string, club: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // The Terms acceptance rides along as metadata and is recorded properly
      // once there is a session (see recordTermsForUser).
      options: {
        data: {
          name,
          club: club || null,
          terms_version: TERMS_VERSION,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    // With email confirmation off, signUp returns an active session immediately;
    // with it on, session is null until the confirmation link is clicked.
    return { error: error?.message ?? null, signedIn: !!data.session };
  }

  // Record the Terms acceptance as soon as the person has a session.
  const userId = user?.id;
  useEffect(() => {
    if (user) void recordTermsForUser(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signInWithGoogle() {
    // Agreement to the Terms is by the notice under the button.
    stashPendingTerms('google_continue');
    // Full-page redirect flow, not a popup — the browser leaves the app and
    // comes back to `redirectTo` with the session already established, so
    // there's no local state to update here beyond surfacing an error if
    // Supabase rejects the request before the redirect even happens.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    // The redirect never happened, so don't leave the stash for a later sign-in.
    if (error) takePendingTerms();
    return error?.message ?? null;
  }

  async function resetPassword(email: string) {
    // redirectTo must be on additional_redirect_urls (Supabase dashboard) —
    // it's where the recovery link lands with a session already attached,
    // not an API callback.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return error?.message ?? null;
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
