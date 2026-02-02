'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { getContractAddresses } from '@/lib/contracts';
import type { Invoice, InvoiceStatus } from './useInvoice';

// ============ Supplier Invoices ============

export function useSupplierInvoiceIds(supplierAddress?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getSupplierInvoices',
    args: supplierAddress ? [supplierAddress] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && !!supplierAddress,
      refetchInterval: 30000,
    },
  });
}

// ============ Buyer Invoices ============

export function useBuyerInvoiceIds(buyerAddress?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getBuyerInvoices',
    args: buyerAddress ? [buyerAddress] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && !!buyerAddress,
      refetchInterval: 30000,
    },
  });
}

// ============ Pending Approvals ============

export function usePendingApprovalIds(buyerAddress?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getPendingApprovals',
    args: buyerAddress ? [buyerAddress] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && !!buyerAddress,
      refetchInterval: 15000, // More frequent for pending items
    },
  });
}

// ============ Upcoming Repayments ============

export function useUpcomingRepaymentIds(buyerAddress?: Address) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  return useReadContract({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getUpcomingRepayments',
    args: buyerAddress ? [buyerAddress] : undefined,
    query: {
      enabled: !!addresses.invoiceDiamond && !!buyerAddress,
      refetchInterval: 30000,
    },
  });
}

// ============ Batch Fetch Invoices ============

export function useInvoices(invoiceIds?: readonly bigint[]) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const contracts = invoiceIds?.map((id) => ({
    address: addresses.invoiceDiamond as Address,
    abi: invoiceDiamondAbi,
    functionName: 'getInvoice' as const,
    args: [id] as const,
  })) ?? [];

  return useReadContracts({
    contracts,
    query: {
      enabled: !!addresses.invoiceDiamond && !!invoiceIds && invoiceIds.length > 0,
      refetchInterval: 30000,
    },
  });
}

// ============ Supplier Invoices with Data ============

export function useSupplierInvoices(supplierAddress?: Address) {
  const { data: invoiceIds, isLoading: idsLoading, error: idsError } = useSupplierInvoiceIds(supplierAddress);
  const { data: invoicesData, isLoading: dataLoading, error: dataError } = useInvoices(invoiceIds);

  const invoices: Invoice[] = invoicesData
    ?.filter((result): result is { status: 'success'; result: Invoice } => result.status === 'success')
    .map((result) => result.result) ?? [];

  return {
    data: invoices,
    invoiceIds,
    isLoading: idsLoading || dataLoading,
    error: idsError || dataError,
  };
}

// ============ Buyer Invoices with Data ============

export function useBuyerInvoices(buyerAddress?: Address) {
  const { data: invoiceIds, isLoading: idsLoading, error: idsError } = useBuyerInvoiceIds(buyerAddress);
  const { data: invoicesData, isLoading: dataLoading, error: dataError } = useInvoices(invoiceIds);

  const invoices: Invoice[] = invoicesData
    ?.filter((result): result is { status: 'success'; result: Invoice } => result.status === 'success')
    .map((result) => result.result) ?? [];

  return {
    data: invoices,
    invoiceIds,
    isLoading: idsLoading || dataLoading,
    error: idsError || dataError,
  };
}

// ============ Pending Approvals with Data ============

export function usePendingApprovals(buyerAddress?: Address) {
  const { data: invoiceIds, isLoading: idsLoading, error: idsError } = usePendingApprovalIds(buyerAddress);
  const { data: invoicesData, isLoading: dataLoading, error: dataError } = useInvoices(invoiceIds);

  const invoices: Invoice[] = invoicesData
    ?.filter((result): result is { status: 'success'; result: Invoice } => result.status === 'success')
    .map((result) => result.result) ?? [];

  return {
    data: invoices,
    invoiceIds,
    isLoading: idsLoading || dataLoading,
    error: idsError || dataError,
    count: invoiceIds?.length ?? 0,
  };
}

// ============ Upcoming Repayments with Data ============

export function useUpcomingRepayments(buyerAddress?: Address) {
  const { data: invoiceIds, isLoading: idsLoading, error: idsError } = useUpcomingRepaymentIds(buyerAddress);
  const { data: invoicesData, isLoading: dataLoading, error: dataError } = useInvoices(invoiceIds);

  const invoices: Invoice[] = invoicesData
    ?.filter((result): result is { status: 'success'; result: Invoice } => result.status === 'success')
    .map((result) => result.result) ?? [];

  // Sort by maturity date (soonest first)
  const sortedInvoices = [...invoices].sort((a, b) =>
    Number(a.maturityDate - b.maturityDate)
  );

  // Calculate totals
  const totalDue = invoices.reduce((sum, inv) => sum + inv.faceValue, 0n);

  return {
    data: sortedInvoices,
    invoiceIds,
    isLoading: idsLoading || dataLoading,
    error: idsError || dataError,
    count: invoiceIds?.length ?? 0,
    totalDue,
  };
}
