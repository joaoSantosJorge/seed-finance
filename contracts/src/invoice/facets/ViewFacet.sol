// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/LibInvoiceStorage.sol";
import "../interfaces/IInvoiceDiamond.sol";

/**
 * @title ViewFacet
 * @notice Provides read-only queries for the Invoice Diamond
 * @dev Part of the Invoice Diamond - all view functions
 */
contract ViewFacet {
    using LibInvoiceStorage for LibInvoiceStorage.Storage;

    // ============ Errors ============

    error InvoiceNotFound(uint256 invoiceId);

    // ============ Invoice Queries ============

    /**
     * @notice Get invoice details
     * @param invoiceId The invoice ID
     * @return invoice The invoice data
     */
    function getInvoice(uint256 invoiceId) external view returns (IInvoiceDiamond.InvoiceView memory invoice) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage inv = s.invoices[invoiceId];

        if (inv.createdAt == 0) revert InvoiceNotFound(invoiceId);

        return IInvoiceDiamond.InvoiceView({
            id: invoiceId,
            buyer: inv.buyer,
            supplier: inv.supplier,
            faceValue: inv.faceValue,
            fundingAmount: inv.fundingAmount,
            maturityDate: inv.maturityDate,
            createdAt: inv.createdAt,
            fundedAt: inv.fundedAt,
            paidAt: inv.paidAt,
            discountRateBps: inv.discountRateBps,
            status: inv.status,
            invoiceHash: inv.invoiceHash,
            externalId: inv.externalId
        });
    }

    /**
     * @notice Get invoices for a supplier
     * @param supplier The supplier address
     * @return invoiceIds Array of invoice IDs
     */
    function getSupplierInvoices(address supplier) external view returns (uint256[] memory invoiceIds) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        return s.supplierInvoices[supplier];
    }

    /**
     * @notice Get invoices for a buyer
     * @param buyer The buyer address
     * @return invoiceIds Array of invoice IDs
     */
    function getBuyerInvoices(address buyer) external view returns (uint256[] memory invoiceIds) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        return s.buyerInvoices[buyer];
    }

    /**
     * @notice Get pending approvals for a buyer
     * @param buyer The buyer address
     * @return invoiceIds Array of pending invoice IDs
     */
    function getPendingApprovals(address buyer) external view returns (uint256[] memory invoiceIds) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        uint256[] storage allInvoices = s.buyerInvoices[buyer];

        // Count pending
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allInvoices.length; i++) {
            if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Pending) {
                pendingCount++;
            }
        }

        // Build array
        invoiceIds = new uint256[](pendingCount);
        uint256 j = 0;
        for (uint256 i = 0; i < allInvoices.length; i++) {
            if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Pending) {
                invoiceIds[j++] = allInvoices[i];
            }
        }
    }

    /**
     * @notice Get upcoming repayments for a buyer
     * @param buyer The buyer address
     * @return invoiceIds Array of funded invoice IDs
     */
    function getUpcomingRepayments(address buyer) external view returns (uint256[] memory invoiceIds) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        uint256[] storage allInvoices = s.buyerInvoices[buyer];

        // Count funded
        uint256 fundedCount = 0;
        for (uint256 i = 0; i < allInvoices.length; i++) {
            if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Funded) {
                fundedCount++;
            }
        }

        // Build array
        invoiceIds = new uint256[](fundedCount);
        uint256 j = 0;
        for (uint256 i = 0; i < allInvoices.length; i++) {
            if (s.invoices[allInvoices[i]].status == LibInvoiceStorage.InvoiceStatus.Funded) {
                invoiceIds[j++] = allInvoices[i];
            }
        }
    }

    /**
     * @notice Get invoices awaiting operator funding approval (Approved status)
     * @return invoiceIds Array of invoice IDs awaiting funding approval
     */
    function getAwaitingFundingApproval() external view returns (uint256[] memory invoiceIds) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        uint256 nextId = s.nextInvoiceId;

        // Count approved (awaiting funding approval)
        uint256 approvedCount = 0;
        for (uint256 i = 1; i < nextId; i++) {
            if (s.invoices[i].status == LibInvoiceStorage.InvoiceStatus.Approved) {
                approvedCount++;
            }
        }

        // Build array
        invoiceIds = new uint256[](approvedCount);
        uint256 j = 0;
        for (uint256 i = 1; i < nextId; i++) {
            if (s.invoices[i].status == LibInvoiceStorage.InvoiceStatus.Approved) {
                invoiceIds[j++] = i;
            }
        }
    }

    /**
     * @notice Get invoices ready for funding (FundingApproved status)
     * @return invoiceIds Array of invoice IDs ready for funding
     */
    function getReadyForFunding() external view returns (uint256[] memory invoiceIds) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        uint256 nextId = s.nextInvoiceId;

        // Count funding approved (ready for funding)
        uint256 fundingApprovedCount = 0;
        for (uint256 i = 1; i < nextId; i++) {
            if (s.invoices[i].status == LibInvoiceStorage.InvoiceStatus.FundingApproved) {
                fundingApprovedCount++;
            }
        }

        // Build array
        invoiceIds = new uint256[](fundingApprovedCount);
        uint256 j = 0;
        for (uint256 i = 1; i < nextId; i++) {
            if (s.invoices[i].status == LibInvoiceStorage.InvoiceStatus.FundingApproved) {
                invoiceIds[j++] = i;
            }
        }
    }

    // ============ Stats Queries ============

    /**
     * @notice Get aggregate statistics
     * @return totalFunded Total USDC funded
     * @return totalRepaid Total USDC repaid
     * @return activeCount Number of active invoices
     * @return nextId Next invoice ID
     */
    function getStats() external view returns (
        uint256 totalFunded,
        uint256 totalRepaid,
        uint256 activeCount,
        uint256 nextId
    ) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        return (
            s.totalFunded,
            s.totalRepaid,
            s.activeInvoiceCount,
            s.nextInvoiceId
        );
    }

    /**
     * @notice Get contract addresses
     * @return executionPool ExecutionPool address
     * @return liquidityPool LiquidityPool address
     * @return usdc USDC address
     */
    function getContractAddresses() external view returns (
        address executionPool,
        address liquidityPool,
        address usdc
    ) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        return (
            s.executionPool,
            s.liquidityPool,
            s.usdc
        );
    }

    // ============ Admin Queries ============

    /**
     * @notice Check if address is operator
     * @param addr Address to check
     * @return isOp True if operator
     */
    function isOperator(address addr) external view returns (bool isOp) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        return s.operators[addr] || addr == s.owner;
    }

    /**
     * @notice Get current owner
     * @return ownerAddr Owner address
     */
    function owner() external view returns (address ownerAddr) {
        return LibInvoiceStorage.getStorage().owner;
    }
}
