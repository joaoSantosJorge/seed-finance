'use client';

import { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { type Address } from 'viem';
import { useChainId } from 'wagmi';
import { invoiceDiamondAbi } from '@/abis/InvoiceDiamond';
import { executionPoolAbi } from '@/abis/ExecutionPool';
import { getContractAddresses } from '@/lib/contracts';
import { InvoiceStatus, type Invoice } from './useInvoice';

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

// ============ Batch Check Repaid Status from ExecutionPool ============

function useRepaidStatus(invoiceIds?: readonly bigint[]) {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const contracts = invoiceIds?.map((id) => ({
    address: addresses.executionPool as Address,
    abi: executionPoolAbi,
    functionName: 'isInvoiceRepaid' as const,
    args: [id] as const,
  })) ?? [];

  return useReadContracts({
    contracts,
    query: {
      enabled: !!addresses.executionPool && !!invoiceIds && invoiceIds.length > 0,
      refetchInterval: 30000,
    },
  });
}

// ============ Upcoming Repayments with Data ============

export function useUpcomingRepayments(buyerAddress?: Address) {
  const chainId = useChainId();
  const { data: invoiceIds, isLoading: idsLoading, error: idsError } = useUpcomingRepaymentIds(buyerAddress);
  const { data: invoicesData, isLoading: dataLoading, error: dataError } = useInvoices(invoiceIds);
  const { data: repaidData, isLoading: repaidLoading } = useRepaidStatus(invoiceIds);

  const invoices: Invoice[] = invoicesData
    ?.filter((result): result is { status: 'success'; result: Invoice } => result.status === 'success')
    .map((result) => result.result) ?? [];

  // Filter out invoices that are already repaid in ExecutionPool
  // This handles the case where ExecutionPool.repayInvoice() was called directly
  // without updating Diamond state
  const unpaidInvoices = invoices.filter((invoice, index) => {
    const repaidResult = repaidData?.[index];
    // Keep invoice if we can't determine repaid status, or if it's NOT repaid
    if (!repaidResult || repaidResult.status !== 'success') return true;
    return repaidResult.result === false;
  });

  // Sort by maturity date (soonest first)
  const sortedInvoices = [...unpaidInvoices].sort((a, b) =>
    Number(a.maturityDate - b.maturityDate)
  );

  // Calculate totals (only for unpaid invoices)
  const totalDue = unpaidInvoices.reduce((sum, inv) => sum + inv.faceValue, 0n);

  return {
    data: sortedInvoices,
    invoiceIds,
    isLoading: idsLoading || dataLoading || repaidLoading,
    error: idsError || dataError,
    count: sortedInvoices.length,
    totalDue,
  };
}

// ============ Buyer Approved Invoices (History) ============

export function useBuyerApprovedInvoices(buyerAddress?: Address) {
  const { data: invoices, isLoading, error } = useBuyerInvoices(buyerAddress);

  const approvedInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter(inv => inv.status >= InvoiceStatus.Approved && inv.status !== InvoiceStatus.Cancelled)
      .sort((a, b) => Number(b.createdAt - a.createdAt));
  }, [invoices]);

  const totalApproved = approvedInvoices.reduce((sum, inv) => sum + inv.faceValue, 0n);

  return { data: approvedInvoices, isLoading, error, count: approvedInvoices.length, totalApproved };
}

// ============ Buyer Paid Invoices (History) ============

export function useBuyerPaidInvoices(buyerAddress?: Address) {
  const { data: invoices, isLoading, error } = useBuyerInvoices(buyerAddress);

  const paidInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter(inv => inv.status === InvoiceStatus.Paid)
      .sort((a, b) => Number(b.paidAt - a.paidAt));
  }, [invoices]);

  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.faceValue, 0n);

  return { data: paidInvoices, isLoading, error, count: paidInvoices.length, totalPaid };
}
