/**
 * Role-based navigation configuration
 * Defines navigation items for each user role in the dashboard
 */

export interface NavItem {
  href: string;
  label: string;
  shortcut?: string;
  mobileLabel?: string; // Shorter label for mobile nav
}

export interface RoleNavigation {
  basePath: string;
  mainItems: NavItem[];
  bottomItems?: NavItem[];
}

// Buyer Navigation
export const buyerNavigation: RoleNavigation = {
  basePath: '/dashboard/buyer',
  mainItems: [
    {
      href: '/dashboard/buyer',
      label: 'OVERVIEW',
      shortcut: '1',
      mobileLabel: 'HOME',
    },
    {
      href: '/dashboard/buyer/invoices',
      label: 'INVOICES',
      shortcut: '2',
      mobileLabel: 'INV',
    },
    {
      href: '/dashboard/buyer/repayments',
      label: 'REPAYMENTS',
      shortcut: '3',
      mobileLabel: 'PAY',
    },
  ],
  bottomItems: [
    {
      href: '/dashboard/buyer/settings',
      label: 'SETTINGS',
      shortcut: 'S',
    },
    {
      href: 'https://docs.seedfinance.xyz',
      label: 'HELP',
      shortcut: '?',
    },
  ],
};

// Supplier Navigation
export const supplierNavigation: RoleNavigation = {
  basePath: '/dashboard/supplier',
  mainItems: [
    {
      href: '/dashboard/supplier',
      label: 'OVERVIEW',
      shortcut: '1',
      mobileLabel: 'HOME',
    },
    {
      href: '/dashboard/supplier/invoices',
      label: 'INVOICES',
      shortcut: '2',
      mobileLabel: 'INV',
    },
    {
      href: '/dashboard/supplier/invoices/create',
      label: 'CREATE',
      shortcut: '3',
      mobileLabel: 'NEW',
    },
  ],
  bottomItems: [
    {
      href: '/dashboard/supplier/settings',
      label: 'SETTINGS',
      shortcut: 'S',
    },
    {
      href: 'https://docs.seedfinance.xyz',
      label: 'HELP',
      shortcut: '?',
    },
  ],
};

// Operator Navigation
export const operatorNavigation: RoleNavigation = {
  basePath: '/dashboard/operator',
  mainItems: [
    {
      href: '/dashboard/operator',
      label: 'OVERVIEW',
      shortcut: '1',
      mobileLabel: 'HOME',
    },
    {
      href: '/dashboard/operator/invoices',
      label: 'INVOICES',
      shortcut: '2',
      mobileLabel: 'INV',
    },
    {
      href: '/dashboard/operator/pool',
      label: 'POOL',
      shortcut: '3',
      mobileLabel: 'POOL',
    },
    {
      href: '/dashboard/operator/treasury',
      label: 'TREASURY',
      shortcut: '4',
      mobileLabel: 'TRSY',
    },
    {
      href: '/dashboard/operator/config',
      label: 'CONFIG',
      shortcut: '5',
      mobileLabel: 'CFG',
    },
  ],
  bottomItems: [
    {
      href: '/dashboard/operator/settings',
      label: 'SETTINGS',
      shortcut: 'S',
    },
    {
      href: 'https://docs.seedfinance.xyz',
      label: 'HELP',
      shortcut: '?',
    },
  ],
};

// Financier Navigation
export const financierNavigation: RoleNavigation = {
  basePath: '/dashboard/financier',
  mainItems: [
    {
      href: '/dashboard/financier',
      label: 'OVERVIEW',
      shortcut: '1',
      mobileLabel: 'HOME',
    },
    {
      href: '/dashboard/financier/deposit',
      label: 'DEPOSIT',
      shortcut: '2',
      mobileLabel: 'IN',
    },
    {
      href: '/dashboard/financier/withdraw',
      label: 'WITHDRAW',
      shortcut: '3',
      mobileLabel: 'OUT',
    },
    {
      href: '/dashboard/financier/portfolio',
      label: 'PORTFOLIO',
      shortcut: '4',
      mobileLabel: 'PORT',
    },
    {
      href: '/dashboard/financier/analytics',
      label: 'ANALYTICS',
      shortcut: '5',
      mobileLabel: 'DATA',
    },
    {
      href: '/dashboard/financier/transactions',
      label: 'HISTORY',
      shortcut: '6',
      mobileLabel: 'LOG',
    },
  ],
  bottomItems: [
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
  ],
};
