import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AuthModal({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  /** Called instead of onClose once a session actually exists — lets the
   * caller resume whatever action prompted the sign-in, rather than just
   * closing the modal and leaving the user to click it again. */
  onAuthenticated?: () => void;
}) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const errorMessage = await signInWithGoogle();
    if (errorMessage) {
      setError(errorMessage);
      setGoogleLoading(false);
    }
    // On success the browser is already navigating away to Google — nothing
    // left to do here.
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signin') {
      setLoading(true);
      const errorMessage = await signIn(email, password);
      setLoading(false);
      if (errorMessage) {
        setError(errorMessage);
        return;
      }
      (onAuthenticated ?? onClose)();
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }

    setLoading(true);
    const { error: errorMessage, signedIn } = await signUp(email, password, name, club);
    setLoading(false);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    if (signedIn) {
      (onAuthenticated ?? onClose)();
    } else {
      setCheckEmail(true);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl">{mode === 'signin' ? 'Sign in' : 'Create an account'}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {checkEmail ? (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Almost there — check <strong>{email}</strong> for a confirmation link, then sign in.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-ink-soft)] disabled:opacity-60"
            >
              {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-ink-soft)]">
              <span className="h-px flex-1 bg-[var(--color-line)]" /> or
              <span className="h-px flex-1 bg-[var(--color-line)]" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Your name
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                      Club (optional)
                    </label>
                    <input
                      value={club}
                      onChange={(e) => setClub(e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 pr-10 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">
                    Repeat password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
                  />
                </div>
              )}

              {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              <p className="text-center text-xs text-[var(--color-ink-soft)]">
                {mode === 'signin' ? "New to Relay? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                    setConfirmPassword('');
                  }}
                  className="font-medium text-[var(--color-brand)] hover:underline"
                >
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
