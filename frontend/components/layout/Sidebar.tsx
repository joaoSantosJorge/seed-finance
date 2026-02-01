'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  PieChart,
  BarChart3,
  History,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  {
    href: '/dashboard/financier',
    label: 'Overview',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    href: '/dashboard/financier/deposit',
    label: 'Deposit',
    icon: <ArrowDownToLine className="w-5 h-5" />,
  },
  {
    href: '/dashboard/financier/withdraw',
    label: 'Withdraw',
    icon: <ArrowUpFromLine className="w-5 h-5" />,
  },
  {
    href: '/dashboard/financier/portfolio',
    label: 'Portfolio',
    icon: <PieChart className="w-5 h-5" />,
  },
  {
    href: '/dashboard/financier/analytics',
    label: 'Analytics',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    href: '/dashboard/financier/transactions',
    label: 'History',
    icon: <History className="w-5 h-5" />,
  },
];

const bottomNavItems: NavItem[] = [
  {
    href: '/dashboard/financier/settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
  },
  {
    href: 'https://docs.seedfinance.xyz',
    label: 'Help',
    icon: <HelpCircle className="w-5 h-5" />,
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
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-seed-green rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-lg font-semibold text-white">Seed Finance</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              isActive(item.href)
                ? 'bg-slate-800 text-white'
                : 'text-cool-gray hover:text-white hover:bg-slate-800/50'
            )}
          >
            {item.icon}
            <span className="text-body font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-4 border-t border-slate-800 space-y-1">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target={item.href.startsWith('http') ? '_blank' : undefined}
            rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-cool-gray hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            {item.icon}
            <span className="text-body font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
