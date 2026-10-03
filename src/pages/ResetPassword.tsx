import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/**
 * Where resetPasswordForEmail's link lands. Supabase attaches the recovery
 * session to the URL itself (detected automatically by the client on load)
 * — by the time this renders, `user` from useAuth is either already the
 * recovering user, or the link was invalid/expired and never arrives.
 */
export function ResetPassword() {
  const { user, loading: authLoading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate('/account'), 2000);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setSubmitting(true);
    const errorMessage = await updatePassword(password);
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="rounded-2xl bg-[var(--color-paper-raised)] p-6 shadow-sm">
        <h1 className="mb-5 text-xl">Reset your password</h1>

        {authLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <Loader2 size={15} className="animate-spin" /> Checking your link…
          </div>
        ) : done ? (
          <p className="flex items-center gap-2 text-sm text-[var(--color-moss)]">
            <CheckCircle2 size={16} /> Password updated — taking you to your account…
          </p>
        ) : !user ? (
          <p className="text-sm text-[var(--color-ink-soft)]">
            This reset link is invalid or has expired. Request a new one from the sign-in form.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">New password</label>
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
            <div>
              <label className="mb-1 block text-xs text-[var(--color-ink-soft)]">Repeat new password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3.5 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
              />
            </div>

            {error && <p className="text-sm text-[var(--color-brand-dark)]">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Set new password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
