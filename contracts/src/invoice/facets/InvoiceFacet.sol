// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/LibInvoiceStorage.sol";
import "../interfaces/IInvoiceDiamond.sol";

/**
 * @title InvoiceFacet
 * @notice Handles invoice creation, approval, and cancellation
 * @dev Part of the Invoice Diamond - manages invoice lifecycle state transitions
 */
contract InvoiceFacet {
    using LibInvoiceStorage for LibInvoiceStorage.Storage;

    // ============ Events ============

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed buyer,
        address indexed supplier,
        uint128 faceValue,
        uint16 discountRateBps,
        uint64 maturityDate
    );

    event InvoiceApproved(
        uint256 indexed invoiceId,
        address indexed buyer,
        uint64 approvedAt
    );

    event InvoiceCancelled(
        uint256 indexed invoiceId,
        address indexed cancelledBy,
        uint64 cancelledAt
    );

    // ============ Errors ============

    error InvoiceNotFound(uint256 invoiceId);
    error InvalidInvoiceStatus(uint256 invoiceId, LibInvoiceStorage.InvoiceStatus expected, LibInvoiceStorage.InvoiceStatus actual);
    error Unauthorized(address caller, string role);
    error ZeroAddress();
    error ZeroAmount();
    error MaturityInPast(uint64 maturityDate);
    error DiscountRateTooHigh(uint16 rate);
    error BuyerCannotBeSupplier();

    // ============ External Functions ============

    /**
     * @notice Create a new invoice
     * @param buyer Address of the buyer
     * @param faceValue Full invoice amount (USDC, 6 decimals)
     * @param discountRateBps Annual discount rate in basis points
     * @param maturityDate Unix timestamp when payment is due
     * @param invoiceHash IPFS CID or document hash
     * @param externalId External reference number
     * @return invoiceId The created invoice ID
     */
    function createInvoice(
        address buyer,
        uint128 faceValue,
        uint16 discountRateBps,
        uint64 maturityDate,
        bytes32 invoiceHash,
        bytes32 externalId
    ) external returns (uint256 invoiceId) {
        // Validate inputs
        if (buyer == address(0)) revert ZeroAddress();
        if (buyer == msg.sender) revert BuyerCannotBeSupplier();
        if (faceValue == 0) revert ZeroAmount();
        if (maturityDate <= block.timestamp) revert MaturityInPast(maturityDate);
        if (discountRateBps > 10000) revert DiscountRateTooHigh(discountRateBps);

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();

        // Assign invoice ID
        invoiceId = s.nextInvoiceId++;

        // Create invoice
        s.invoices[invoiceId] = LibInvoiceStorage.Invoice({
            buyer: buyer,
            supplier: msg.sender,
            faceValue: faceValue,
            fundingAmount: 0,
            maturityDate: maturityDate,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            paidAt: 0,
            discountRateBps: discountRateBps,
            status: LibInvoiceStorage.InvoiceStatus.Pending,
            invoiceHash: invoiceHash,
            externalId: externalId
        });

        // Track by supplier and buyer
        s.supplierInvoices[msg.sender].push(invoiceId);
        s.buyerInvoices[buyer].push(invoiceId);

        emit InvoiceCreated(
            invoiceId,
            buyer,
            msg.sender,
            faceValue,
            discountRateBps,
            maturityDate
        );
    }

    /**
     * @notice Approve an invoice (buyer only)
     * @param invoiceId The invoice ID to approve
     */
    function approveInvoice(uint256 invoiceId) external {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Check invoice exists
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);

        // Check caller is buyer
        if (msg.sender != invoice.buyer) {
            revert Unauthorized(msg.sender, "buyer");
        }

        // Check status is Pending
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Pending) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.Pending,
                invoice.status
            );
        }

        // Update status
        invoice.status = LibInvoiceStorage.InvoiceStatus.Approved;

        emit InvoiceApproved(invoiceId, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Cancel a pending invoice
     * @dev Can be called by buyer or supplier, only for Pending invoices
     * @param invoiceId The invoice ID to cancel
     */
    function cancelInvoice(uint256 invoiceId) external {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        LibInvoiceStorage.Invoice storage invoice = s.invoices[invoiceId];

        // Check invoice exists
        if (invoice.createdAt == 0) revert InvoiceNotFound(invoiceId);

        // Check caller is buyer or supplier
        if (msg.sender != invoice.buyer && msg.sender != invoice.supplier) {
            revert Unauthorized(msg.sender, "buyer or supplier");
        }

        // Check status is Pending
        if (invoice.status != LibInvoiceStorage.InvoiceStatus.Pending) {
            revert InvalidInvoiceStatus(
                invoiceId,
                LibInvoiceStorage.InvoiceStatus.Pending,
                invoice.status
            );
        }

        // Update status
        invoice.status = LibInvoiceStorage.InvoiceStatus.Cancelled;

        emit InvoiceCancelled(invoiceId, msg.sender, uint64(block.timestamp));
    }
}
