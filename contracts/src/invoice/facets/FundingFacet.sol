// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/LibInvoiceStorage.sol";

/**
 * @title FundingFacet
 * @notice Handles invoice funding operations
 * @dev Part of the Invoice Diamond - coordinates with ExecutionPool to fund invoices
 */
contract FundingFacet {
    using SafeERC20 for IERC20;
    using LibInvoiceStorage for LibInvoiceStorage.Storage;

    // ============ Events ============

    event InvoiceFunded(
        uint256 indexed invoiceId,
        address indexed supplier,
        uint128 fundingAmount,
        uint128 discount,
        uint64 fundedAt
    );

    event FundingRequested(
        uint256 indexed invoiceId,
        uint128 amount
    );

    event FundingApprovalGranted(
        uint256 indexed invoiceId,
        address indexed operator,
        uint64 approvedAt
    );

    // ============ Errors ============

    error InvoiceNotFound(uint256 invoiceId);
    error InvalidInvoiceStatus(uint256 invoiceId, LibInvoiceStorage.InvoiceStatus expected, LibInvoiceStorage.InvoiceStatus actual);
    error Unauthorized(address caller, string role);
    error ExecutionPoolNotSet();
    error InsufficientFunds(uint256 required, uint256 available);

    // ============ External Functions ============

    /**
     * @notice Approve funding for an invoice (operator approval step)
     * @dev Only callable by operators. Moves invoice from Approved to FundingApproved status
     * @param invoiceId The invoice ID to approve funding for
     */
    function approveFunding(uint256 invoiceId) external {
        LibInvoiceStorage.enforceIsOperator();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Validate
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Approved) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.Approved,
                invoice.status
            );
        }

        // Update status to FundingApproved
        invoice.status = LibInvoiceStorage.InvoiceStatus.FundingApproved;

        emit FundingApprovalGranted(invoiceId, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Batch approve funding for multiple invoices
     * @dev Only callable by operators. Skips invoices that aren't in Approved status
     * @param invoiceIds Array of invoice IDs to approve funding for
     */
    function batchApproveFunding(uint256[] calldata invoiceIds) external {
        LibInvoiceStorage.enforceIsOperator();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();

        for (uint256 i = 0; i < invoiceIds.length; i++) {
            uint256 invoiceId = invoiceIds[i];
            LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

            // Skip if not in Approved status
            if (invoice.createdAt == 0 || invoice.status != LibInvoiceStorage.InvoiceStatus.Approved) {
                continue;
            }

            // Update status to FundingApproved
            invoice.status = LibInvoiceStorage.InvoiceStatus.FundingApproved;

            emit FundingApprovalGranted(invoiceId, msg.sender, uint64(block.timestamp));
        }
    }

    /**
     * @notice Request funding for a funding-approved invoice
     * @dev Only callable by operators. Calculates funding amount and coordinates with ExecutionPool
     * @param invoiceId The invoice ID to fund
     */
    function requestFunding(uint256 invoiceId) external {
        LibInvoiceStorage.enforceIsOperator();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Validate
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.FundingApproved) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.FundingApproved,
                invoice.status
            );
        }
        if (s.executionPool == address(0)) revert ExecutionPoolNotSet();

        // Calculate funding amount
        uint256 secondsToMaturity = invoice.maturityDate > block.timestamp
            ? invoice.maturityDate - block.timestamp
            : 0;

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            invoice.faceValue,
            invoice.discountRateBps,
            secondsToMaturity
        );

        uint128 discount = invoice.faceValue - fundingAmount;

        // Update invoice state
        invoice.fundingAmount = fundingAmount;
        invoice.status = LibInvoiceStorage.InvoiceStatus.Funded;
        invoice.fundedAt = uint64(block.timestamp);

        // Update stats
        s.totalFunded += fundingAmount;
        s.activeInvoiceCount++;

        // Emit funding requested event (ExecutionPool listens to this or is called directly)
        emit FundingRequested(invoiceId, fundingAmount);

        emit InvoiceFunded(
            invoiceId,
            invoice.supplier,
            fundingAmount,
            discount,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Supplier requests funding for their own funding-approved invoice
     * @dev Only callable by the invoice supplier. Allows suppliers to trigger funding after operator approval
     * @param invoiceId The invoice ID to fund
     */
    function supplierRequestFunding(uint256 invoiceId) external {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Validate
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);
        if (invoice.supplier != msg.sender) revert Unauthorized(msg.sender, "supplier");
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.FundingApproved) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.FundingApproved,
                invoice.status
            );
        }
        if (s.executionPool == address(0)) revert ExecutionPoolNotSet();

        // Calculate funding amount
        uint256 secondsToMaturity = invoice.maturityDate > block.timestamp
            ? invoice.maturityDate - block.timestamp
            : 0;

        uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
            invoice.faceValue,
            invoice.discountRateBps,
            secondsToMaturity
        );

        uint128 discount = invoice.faceValue - fundingAmount;

        // Update invoice state
        invoice.fundingAmount = fundingAmount;
        invoice.status = LibInvoiceStorage.InvoiceStatus.Funded;
        invoice.fundedAt = uint64(block.timestamp);

        // Update stats
        s.totalFunded += fundingAmount;
        s.activeInvoiceCount++;

        // Emit funding requested event (ExecutionPool listens to this or is called directly)
        emit FundingRequested(invoiceId, fundingAmount);

        emit InvoiceFunded(
            invoiceId,
            invoice.supplier,
            fundingAmount,
            discount,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Batch fund multiple funding-approved invoices
     * @dev Only callable by operators. Skips invoices that aren't in FundingApproved status
     * @param invoiceIds Array of invoice IDs to fund
     */
    function batchFund(uint256[] calldata invoiceIds) external {
        LibInvoiceStorage.enforceIsOperator();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        if (s.executionPool == address(0)) revert ExecutionPoolNotSet();

        for (uint256 i = 0; i < invoiceIds.length; i++) {
            uint256 invoiceId = invoiceIds[i];
            LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

            // Skip if not funding-approved
            if (invoice.createdAt == 0 || invoice.status != LibInvoiceStorage.InvoiceStatus.FundingApproved) {
                continue;
            }

            // Calculate funding amount
            uint256 secondsToMaturity = invoice.maturityDate > block.timestamp
                ? invoice.maturityDate - block.timestamp
                : 0;

            uint128 fundingAmount = LibInvoiceStorage.calculateFundingAmount(
                invoice.faceValue,
                invoice.discountRateBps,
                secondsToMaturity
            );

            uint128 discount = invoice.faceValue - fundingAmount;

            // Update invoice state
            invoice.fundingAmount = fundingAmount;
            invoice.status = LibInvoiceStorage.InvoiceStatus.Funded;
            invoice.fundedAt = uint64(block.timestamp);

            // Update stats
            s.totalFunded += fundingAmount;
            s.activeInvoiceCount++;

            emit FundingRequested(invoiceId, fundingAmount);

            emit InvoiceFunded(
                invoiceId,
                invoice.supplier,
                fundingAmount,
                discount,
                uint64(block.timestamp)
            );
        }
    }

    // ============ View Functions ============

    /**
     * @notice Check if an invoice can have its funding approved
     * @param invoiceId The invoice ID to check
     * @return canApprove True if invoice can have funding approved
     */
    function canApproveFunding(uint256 invoiceId) external view returns (bool canApprove) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        return invoice.createdAt != 0 &&
               invoice.status == LibInvoiceStorage.InvoiceStatus.Approved;
    }

    /**
     * @notice Check if an invoice can be funded
     * @param invoiceId The invoice ID to check
     * @return canFund True if invoice can be funded
     */
    function canFundInvoice(uint256 invoiceId) external view returns (bool canFund) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        return invoice.createdAt != 0 &&
               invoice.status == LibInvoiceStorage.InvoiceStatus.FundingApproved &&
               s.executionPool != address(0);
    }

    /**
     * @notice Get the funding amount for an invoice
     * @param invoiceId The invoice ID
     * @return amount The funding amount (after discount)
     */
    function getFundingAmount(uint256 invoiceId) external view returns (uint128 amount) {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);

        // If already funded, return stored amount
        if (invoice.fundingAmount > 0) {
            return invoice.fundingAmount;
        }

        // Calculate based on current time
        uint256 secondsToMaturity = invoice.maturityDate > block.timestamp
            ? invoice.maturityDate - block.timestamp
            : 0;

        return LibInvoiceStorage.calculateFundingAmount(
            invoice.faceValue,
            invoice.discountRateBps,
            secondsToMaturity
        );
    }
}
