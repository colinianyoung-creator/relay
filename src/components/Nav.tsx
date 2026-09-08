import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Plus, CircleUserRound, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthModal } from './AuthModal';
import { Avatar } from './Avatar';

export function Nav() {
  const { user, profile, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand)] font-display text-base text-white">
            R
          </span>
          <span className="font-display text-xl">Relay</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--color-ink-soft)] sm:flex">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)]')}>
            Browse
          </NavLink>
          <NavLink to="/wanted" className={({ isActive }) => (isActive ? 'text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)]')}>
            Wanted
          </NavLink>
          <NavLink to="/fleets" className={({ isActive }) => (isActive ? 'text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)]')}>
            Fleets
          </NavLink>
          <NavLink to="/how-it-works" className={({ isActive }) => (isActive ? 'text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)]')}>
            How it works
          </NavLink>
          {user && (
            <NavLink to="/account" className={({ isActive }) => (isActive ? 'text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)]')}>
              My activity
            </NavLink>
          )}
          {profile?.is_admin && (
            <NavLink
              to="/admin/reports"
              className={({ isActive }) =>
                `flex items-center gap-1 ${isActive ? 'text-[var(--color-brand)]' : 'hover:text-[var(--color-brand)]'}`
              }
            >
              <ShieldAlert size={14} /> Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/sell"
            className="hidden items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition hover:bg-black sm:flex"
          >
            <Plus size={16} strokeWidth={2.25} />
            List equipment
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/account" aria-label="My activity">
                <Avatar name={profile?.name ?? user.email ?? '?'} avatarUrl={profile?.avatar_url} className="h-9 w-9 text-sm" />
              </Link>
              <button
                onClick={() => {
                  signOut();
                  navigate('/');
                }}
                aria-label="Sign out"
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] sm:flex"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
              aria-label="Sign in"
            >
              <CircleUserRound size={20} />
            </button>
          )}
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
}
