import { NavLink } from 'react-router-dom';
import { ShieldAlert, Users, Receipt, History } from 'lucide-react';

const TABS = [
  { to: '/admin/reports', label: 'Reports', icon: ShieldAlert },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/orders', label: 'Orders', icon: Receipt },
  { to: '/admin/log', label: 'Activity', icon: History },
];

export function AdminTabs() {
  return (
    <div className="mb-8 flex flex-wrap gap-2 border-b border-[var(--color-line)] pb-4">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              isActive
                ? 'bg-[var(--color-ink)] text-white'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`
          }
        >
          <tab.icon size={14} /> {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
