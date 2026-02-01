'use client';

import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Sidebar - Desktop only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        <Header title={title} />
        <main className="p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t-2 border-[var(--border-color)] z-40">
        <MobileNav />
      </div>
    </div>
  );
}

// Mobile Bottom Navigation
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

function MobileNav() {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard/financier', label: 'HOME' },
    { href: '/dashboard/financier/deposit', label: 'IN' },
    { href: '/dashboard/financier/withdraw', label: 'OUT' },
    { href: '/dashboard/financier/analytics', label: 'DATA' },
    { href: '/dashboard/financier/transactions', label: 'LOG' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard/financier') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center justify-around py-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'px-3 py-1 font-bold text-xs tracking-wider transition-colors',
            isActive(item.href)
              ? 'bg-[var(--border-color)] text-[var(--bg-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--accent)]'
          )}
        >
          [{item.label}]
        </Link>
      ))}
    </nav>
  );
}
