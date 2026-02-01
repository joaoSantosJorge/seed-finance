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
    <div className="min-h-screen bg-deep-navy">
      {/* Sidebar - Desktop only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="lg:ml-60">
        <Header title={title} />
        <main className="p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40">
        <MobileNav />
      </div>
    </div>
  );
}

// Mobile Bottom Navigation
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function MobileNav() {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard/financier', icon: LayoutDashboard, label: 'Home' },
    { href: '/dashboard/financier/deposit', icon: ArrowDownToLine, label: 'Deposit' },
    { href: '/dashboard/financier/withdraw', icon: ArrowUpFromLine, label: 'Withdraw' },
    { href: '/dashboard/financier/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/dashboard/financier/transactions', icon: History, label: 'History' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard/financier') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex items-center justify-around py-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex flex-col items-center gap-1 px-3 py-2',
            isActive(item.href) ? 'text-primary' : 'text-cool-gray'
          )}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-caption">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
