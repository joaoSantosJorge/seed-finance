'use client';

import { useReadContracts } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { useMemo } from 'react';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { getContractAddresses } from '@/lib/contracts';
import { useInvoiceStats, type Invoice, type InvoiceStatus } from '../invoice/useInvoice';

// Note: useInvoiceStats is NOT re-exported here to avoid conflicts
// Import directly from '@/hooks/invoice' instead

/**
 * Hook to fetch all invoices (for admin view)
 * Fetches invoices by iterating through IDs from 1 to nextId
 */
export function useAllInvoices(statusFilter?: InvoiceStatus) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { data: stats, isLoading: statsLoading } = useInvoiceStats();

  // Generate invoice IDs from 1 to nextId-1
  const invoiceIds = useMemo(() => {
    if (!stats) return [];
    const nextId = stats[3]; // nextId is the 4th element
    const ids: bigint[] = [];
    for (let i = 1n; i < nextId; i++) {
      ids.push(i);
    }
    return ids;
  }, [stats]);

  // Batch fetch all invoices
  const contracts = invoiceIds.map((id) => ({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getInvoice' as const,
    args: [id] as const,
  }));

  const { data: invoicesData, isLoading: invoicesLoading, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: !!addresses.invoiceDiamond && invoiceIds.length > 0,
      refetchInterval: 15000,
    },
  });

  // Filter and process invoices
  const invoices: Invoice[] = useMemo(() => {
    if (!invoicesData) return [];

    const allInvoices = invoicesData
      .filter((result): result is { status: 'success'; result: Invoice } => result.status === 'success')
      .map((result) => result.result);

    if (statusFilter !== undefined) {
      return allInvoices.filter((inv) => inv.status === statusFilter);
    }

    return allInvoices;
  }, [invoicesData, statusFilter]);

  return {
    data: invoices,
    stats,
    isLoading: statsLoading || invoicesLoading,
    refetch,
  };
}

/**
 * Hook to get invoices awaiting operator funding approval (Approved status)
 */
export function useAwaitingFundingApproval() {
  const { data, stats, isLoading, refetch } = useAllInvoices(1); // InvoiceStatus.Approved = 1

  return {
    data,
    count: data.length,
    isLoading,
    refetch,
    stats,
  };
}

/**
 * Hook to get approved invoices (alias for useAwaitingFundingApproval for backwards compatibility)
 */
export function useApprovedInvoices() {
  return useAwaitingFundingApproval();
}

/**
 * Hook to get invoices ready for funding (FundingApproved status)
 */
export function useReadyForFunding() {
  const { data, stats, isLoading, refetch } = useAllInvoices(2); // InvoiceStatus.FundingApproved = 2

  return {
    data,
    count: data.length,
    isLoading,
    refetch,
    stats,
  };
}

/**
 * Hook to get overdue funded invoices (past maturity, not paid)
 */
export function useOverdueInvoices() {
  const { data: allFunded, isLoading, refetch } = useAllInvoices(3); // InvoiceStatus.Funded = 3

  const overdueInvoices = useMemo(() => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    return allFunded.filter((inv) => inv.maturityDate < now);
  }, [allFunded]);

  return {
    data: overdueInvoices,
    count: overdueInvoices.length,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get funded invoices (active)
 */
export function useFundedInvoices() {
  const { data, isLoading, refetch } = useAllInvoices(3); // InvoiceStatus.Funded = 3

  return {
    data,
    count: data.length,
    isLoading,
    refetch,
  };
}
