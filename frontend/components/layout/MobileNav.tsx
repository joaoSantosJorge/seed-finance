'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { type RoleNavigation } from '@/lib/config/navigation';

interface MobileNavProps {
  navigation: RoleNavigation;
}

export function MobileNav({ navigation }: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === navigation.basePath) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Limit mobile items to 5 for space
  const mobileItems = navigation.mainItems.slice(0, 5);

  return (
    <nav className="flex items-center justify-around py-3">
      {mobileItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'px-3 py-1 font-bold text-xs tracking-wider transition-colors',
            isActive(item.href)
              ? 'bg-[var(--border-color)] text-[var(--bg-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          [{item.mobileLabel || item.label}]
        </Link>
      ))}
    </nav>
  );
}
