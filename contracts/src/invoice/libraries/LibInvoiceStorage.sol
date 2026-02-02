// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title LibInvoiceStorage
 * @notice Diamond storage library for Invoice system
 * @dev Uses keccak256 slot pattern to prevent storage collisions
 *      All state for the Invoice Diamond is stored here
 */
library LibInvoiceStorage {
    /// @dev Storage slot for invoice storage
    bytes32 constant STORAGE_SLOT = keccak256("seedfinance.invoice.storage");

    /// @notice Invoice status enumeration
    enum InvoiceStatus {
        Pending,    // 0 - Created, awaiting buyer approval
        Approved,   // 1 - Buyer approved, ready for funding
        Funded,     // 2 - Funds sent to supplier
        Paid,       // 3 - Buyer repaid, invoice complete
        Cancelled,  // 4 - Cancelled by buyer or supplier
        Defaulted   // 5 - Overdue and marked as default
    }

    /// @notice Invoice data structure
    /// @dev Packed for gas efficiency
    struct Invoice {
        address buyer;              // 20 bytes - Buyer's address
        address supplier;           // 20 bytes - Supplier's address
        uint128 faceValue;          // 16 bytes - Full invoice amount (USDC, 6 decimals)
        uint128 fundingAmount;      // 16 bytes - Amount funded to supplier (calculated at funding)
        uint64 maturityDate;        // 8 bytes - Unix timestamp when payment is due
        uint64 createdAt;           // 8 bytes - Unix timestamp of creation
        uint64 fundedAt;            // 8 bytes - Unix timestamp when funded
        uint64 paidAt;              // 8 bytes - Unix timestamp when paid
        uint16 discountRateBps;     // 2 bytes - Annual discount rate in basis points
        InvoiceStatus status;       // 1 byte - Current status
        bytes32 invoiceHash;        // 32 bytes - IPFS CID or document hash
        bytes32 externalId;         // 32 bytes - External reference number
    }

    /// @notice Main storage struct for Invoice Diamond
    struct Storage {
        // Invoice data
        mapping(uint256 => Invoice) invoices;
        mapping(address => uint256[]) supplierInvoices;
        mapping(address => uint256[]) buyerInvoices;
        uint256 nextInvoiceId;

        // Aggregated stats
        uint256 totalFunded;        // Total USDC funded across all invoices
        uint256 totalRepaid;        // Total USDC repaid
        uint256 activeInvoiceCount; // Number of currently funded (active) invoices

        // Contract references
        address executionPool;
        address liquidityPool;
        address usdc;

        // Access control
        mapping(address => bool) operators;
        address owner;

        // Extension slots for future facets
        mapping(uint256 => bytes32) extensionData;
        mapping(address => uint256) buyerCreditLimits;
        mapping(uint256 => uint256) invoicePenalties;  // For PenaltyFacet
        mapping(uint256 => uint256) invoiceRebates;    // For RebateFacet
    }

    /// @notice Get storage pointer
    /// @return s Storage pointer to the invoice storage slot
    function getStorage() internal pure returns (Storage storage s) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            s.slot := slot
        }
    }

    // ============ Helper Functions ============

    /// @notice Check if invoice exists
    /// @param invoiceId The invoice ID to check
    /// @return exists True if invoice exists
    function invoiceExists(uint256 invoiceId) internal view returns (bool exists) {
        Storage storage s = getStorage();
        return s.invoices[invoiceId].createdAt != 0;
    }

    /// @notice Get invoice by ID
    /// @param invoiceId The invoice ID
    /// @return invoice The invoice data
    function getInvoice(uint256 invoiceId) internal view returns (Invoice storage invoice) {
        Storage storage s = getStorage();
        return s.invoices[invoiceId];
    }

    /// @notice Calculate funding amount (face value minus discount)
    /// @param faceValue The full invoice amount
    /// @param discountRateBps Annual discount rate in basis points
    /// @param secondsToMaturity Seconds until maturity
    /// @return fundingAmount The discounted funding amount
    function calculateFundingAmount(
        uint128 faceValue,
        uint16 discountRateBps,
        uint256 secondsToMaturity
    ) internal pure returns (uint128 fundingAmount) {
        // Simple interest: discount = face_value * rate * time / (365 days)
        uint256 annualDiscount = (uint256(faceValue) * uint256(discountRateBps)) / 10000;
        uint256 discount = (annualDiscount * secondsToMaturity) / 365 days;
        return uint128(uint256(faceValue) - discount);
    }

    /// @notice Check if caller is the owner
    /// @return isOwner True if caller is owner
    function isOwner() internal view returns (bool) {
        return msg.sender == getStorage().owner;
    }

    /// @notice Check if caller is an operator
    /// @return isOp True if caller is operator
    function isOperator() internal view returns (bool) {
        Storage storage s = getStorage();
        return s.operators[msg.sender] || msg.sender == s.owner;
    }

    /// @notice Enforce operator access
    function enforceIsOperator() internal view {
        require(isOperator(), "LibInvoiceStorage: not operator");
    }

    /// @notice Enforce owner access
    function enforceIsOwner() internal view {
        require(isOwner(), "LibInvoiceStorage: not owner");
    }
}
