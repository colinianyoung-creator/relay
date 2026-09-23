import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Plus, CircleUserRound, LogOut, Menu, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthModal } from './AuthModal';
import { Avatar } from './Avatar';

export function Nav() {
  const { user, profile, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
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
          <NavLink to="/club-gear" className={({ isActive }) => (isActive ? 'text-[var(--color-ink)]' : 'hover:text-[var(--color-ink)]')}>
            Club Gear
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

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/sell"
            className="hidden items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition hover:bg-black sm:flex"
          >
            <Plus size={16} strokeWidth={2.25} />
            Sell equipment
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
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] sm:px-4"
            >
              <CircleUserRound size={16} />
              Sign in
            </button>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink)] sm:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-[var(--color-line)] bg-[var(--color-paper)] px-4 pb-4 pt-2 sm:hidden">
          {[
            { to: '/', label: 'Browse', end: true },
            { to: '/club-gear', label: 'Club Gear' },
            { to: '/how-it-works', label: 'How it works' },
            ...(user ? [{ to: '/account', label: 'My activity' }] : []),
            ...(profile?.is_admin ? [{ to: '/admin/reports', label: 'Admin' }] : []),
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-3 text-base font-medium ${
                  isActive ? 'bg-[var(--color-line)]/50 text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/sell"
            className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-white"
          >
            <Plus size={16} strokeWidth={2.25} /> Sell equipment
          </Link>
          {user && (
            <button
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-ink-soft)]"
            >
              <LogOut size={15} /> Sign out
            </button>
          )}
        </nav>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
}
