import { DashboardLayout } from '@/components/layout';

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
