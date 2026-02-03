'use client';

import { DashboardLayout } from '@/components/layout';
import { supplierNavigation } from '@/lib/config/navigation';

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout navigation={supplierNavigation}>{children}</DashboardLayout>;
}
