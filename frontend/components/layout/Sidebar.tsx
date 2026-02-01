'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  shortcut?: string;
}

const mainNavItems: NavItem[] = [
  {
    href: '/dashboard/financier',
    label: 'OVERVIEW',
    shortcut: '1',
  },
  {
    href: '/dashboard/financier/deposit',
    label: 'DEPOSIT',
    shortcut: '2',
  },
  {
    href: '/dashboard/financier/withdraw',
    label: 'WITHDRAW',
    shortcut: '3',
  },
  {
    href: '/dashboard/financier/portfolio',
    label: 'PORTFOLIO',
    shortcut: '4',
  },
  {
    href: '/dashboard/financier/analytics',
    label: 'ANALYTICS',
    shortcut: '5',
  },
  {
    href: '/dashboard/financier/transactions',
    label: 'HISTORY',
    shortcut: '6',
  },
];

const bottomNavItems: NavItem[] = [
  {
    href: '/dashboard/financier/settings',
    label: 'SETTINGS',
    shortcut: 'S',
  },
  {
    href: 'https://docs.seedfinance.xyz',
    label: 'HELP',
    shortcut: '?',
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard/financier') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[var(--bg-card)] border-r-2 border-[var(--border-color)] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b-2 border-[var(--border-color)]">
        <Link href="/" className="block">
          <pre className="text-[var(--text-primary)] text-xs leading-tight">
{`  ____  ____  ____  ____
 / ___)(  __)(  __)(    \\
 \\___ \\ ) _)  ) _)  ) D (
 (____/(____)(____)(____/`}
          </pre>
          <p className="text-[var(--text-muted)] text-xs mt-2 tracking-widest">FINANCE v1.0</p>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-4 px-2">
          -- NAVIGATION --
        </p>
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 transition-colors font-bold text-sm tracking-wider',
                isActive(item.href)
                  ? 'bg-[var(--border-color)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              )}
            >
              <span>{isActive(item.href) ? `> ${item.label}` : `  ${item.label}`}</span>
              <span className="text-[var(--text-muted)] text-xs">[{item.shortcut}]</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t-2 border-[var(--border-color)]">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-4 px-2">
          -- SYSTEM --
        </p>
        <div className="space-y-1">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="flex items-center justify-between px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors font-bold text-sm tracking-wider"
            >
              <span>  {item.label}</span>
              <span className="text-xs">[{item.shortcut}]</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="p-4 border-t-2 border-[var(--border-color)] text-xs text-[var(--text-muted)]">
        <p>STATUS: <span className="text-[var(--text-primary)]">CONNECTED</span></p>
        <p>NETWORK: <span className="text-[var(--text-primary)]">BASE</span></p>
      </div>
    </aside>
  );
}
