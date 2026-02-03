'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { OperatorGuard } from '@/components/operator';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Database,
  Vault,
  Settings,
  Shield,
} from 'lucide-react';

const navItems = [
  {
    href: '/dashboard/operator',
    label: 'Overview',
    icon: LayoutDashboard,
  },
  {
    href: '/dashboard/operator/invoices',
    label: 'Invoices',
    icon: FileText,
  },
  {
    href: '/dashboard/operator/pool',
    label: 'Pool',
    icon: Database,
  },
  {
    href: '/dashboard/operator/treasury',
    label: 'Treasury',
    icon: Vault,
  },
  {
    href: '/dashboard/operator/config',
    label: 'Config',
    icon: Settings,
  },
];

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <DashboardLayout>
      <OperatorGuard>
        <div className="space-y-6">
          {/* Operator Header */}
          <div className="flex items-center gap-3 pb-4 border-b-2 border-[var(--border-color)]">
            <div className="w-10 h-10 bg-[var(--text-primary)]/10 border-2 border-[var(--border-color)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-[var(--text-primary)]" />
            </div>
            <div>
              <h1 className="text-h2 text-white">Operator Dashboard</h1>
              <p className="text-body-sm text-cool-gray">
                Manage invoices, pool, and system configuration
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex gap-1 p-1 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard/operator'
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-body-sm font-medium uppercase tracking-wider transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                      : 'text-cool-gray hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Page Content */}
          <div>{children}</div>
        </div>
      </OperatorGuard>
    </DashboardLayout>
  );
}
