// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/LibInvoiceStorage.sol";
import "../interfaces/IExecutionPool.sol";

/**
 * @title RepaymentFacet
 * @notice Handles invoice repayment operations
 * @dev Part of the Invoice Diamond - processes buyer repayments
 */
contract RepaymentFacet {
    using SafeERC20 for IERC20;
    using LibInvoiceStorage for LibInvoiceStorage.Storage;

    // ============ Events ============

    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed buyer,
        uint128 amountPaid,
        uint64 paidAt
    );

    event InvoiceDefaulted(
        uint256 indexed invoiceId,
        uint64 defaultedAt
    );

    event RepaymentProcessed(
        uint256 indexed invoiceId,
        uint128 principal,
        uint128 yield
    );

    // ============ Errors ============

    error InvoiceNotFound(uint256 invoiceId);
    error InvalidInvoiceStatus(uint256 invoiceId, LibInvoiceStorage.InvoiceStatus expected, LibInvoiceStorage.InvoiceStatus actual);
    error Unauthorized(address caller, string role);
    error USDCNotSet();
    error NotOverdue(uint256 invoiceId);

    // ============ External Functions ============

    /**
     * @notice Process repayment for a funded invoice
     * @dev Only callable by the buyer. Transfers face value from buyer to ExecutionPool
     * @param invoiceId The invoice ID to repay
     */
    function processRepayment(uint256 invoiceId) external {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Validate
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);
        if (msg.sender != invoice.buyer) {
            revert Unauthorized(msg.sender, "buyer");
        }
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Funded) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.Funded,
                invoice.status
            );
        }
        if (s.usdc == address(0)) revert USDCNotSet();

        uint128 repaymentAmount = invoice.faceValue;
        uint128 principal = invoice.fundingAmount;
        uint128 yield = repaymentAmount - principal;

        // Update invoice state
        invoice.status = LibInvoiceStorage.InvoiceStatus.Paid;
        invoice.paidAt = uint64(block.timestamp);

        // Update stats
        s.totalRepaid += repaymentAmount;
        s.activeInvoiceCount--;

        // Transfer USDC from buyer to this contract (Diamond)
        // ExecutionPool will then handle the LiquidityPool interaction
        IERC20(s.usdc).safeTransferFrom(msg.sender, address(this), repaymentAmount);

        // If ExecutionPool is set, transfer to it and trigger repayment flow
        // This ensures funds return to LiquidityPool with proper yield tracking
        if (s.executionPool != address(0)) {
            IERC20(s.usdc).safeTransfer(s.executionPool, repaymentAmount);
            IExecutionPool(s.executionPool).receiveRepayment(invoiceId, msg.sender);
        }

        emit InvoicePaid(
            invoiceId,
            msg.sender,
            repaymentAmount,
            uint64(block.timestamp)
        );

        emit RepaymentProcessed(invoiceId, principal, yield);
    }

    /**
     * @notice Mark an invoice as defaulted
     * @dev Only callable by operators. Invoice must be funded and overdue
     * @param invoiceId The invoice ID to default
     */
    function markDefaulted(uint256 invoiceId) external {
        LibInvoiceStorage.enforceIsOperator();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Validate
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Funded) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.Funded,
                invoice.status
            );
        }

        // Check if overdue
        if (block.timestamp <= invoice.maturityDate) {
            revert NotOverdue(invoiceId);
        }

        // Update status
        invoice.status = LibInvoiceStorage.InvoiceStatus.Defaulted;
        s.activeInvoiceCount--;

        emit InvoiceDefaulted(invoiceId, uint64(block.timestamp));
    }

    // ============ View Functions ============

    /**
     * @notice Get repayment amount for an invoice
     * @param invoiceId The invoice ID
     * @return amount The repayment amount (face value)
     */
    function getRepaymentAmount(uint256 invoiceId) external view returns (uint128 amount) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);

        return invoice.faceValue;
    }

    /**
     * @notice Check if an invoice is overdue
     * @param invoiceId The invoice ID
     * @return overdue True if overdue
     */
    function isOverdue(uint256 invoiceId) external view returns (bool overdue) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);

        return invoice.status == LibInvoiceStorage.InvoiceStatus.Funded &&
               block.timestamp > invoice.maturityDate;
    }
}
