// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/LibInvoiceStorage.sol";

/**
 * @title IInvoiceDiamond
 * @notice Combined interface for Invoice Diamond facets
 * @dev Aggregates all function signatures, events, and errors
 */
interface IInvoiceDiamond {
    // ============ Structs ============

    /// @notice Invoice data structure (external view)
    struct InvoiceView {
        uint256 id;
        address buyer;
        address supplier;
        uint128 faceValue;
        uint128 fundingAmount;
        uint64 maturityDate;
        uint64 createdAt;
        uint64 fundedAt;
        uint64 paidAt;
        uint16 discountRateBps;
        LibInvoiceStorage.InvoiceStatus status;
        bytes32 invoiceHash;
        bytes32 externalId;
    }

    // ============ Events ============

    /// @notice Emitted when an invoice is created
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed buyer,
        address indexed supplier,
        uint128 faceValue,
        uint16 discountRateBps,
        uint64 maturityDate
    );

    /// @notice Emitted when an invoice is approved by buyer
    event InvoiceApproved(
        uint256 indexed invoiceId,
        address indexed buyer,
        uint64 approvedAt
    );

    /// @notice Emitted when operator approves funding for an invoice
    event FundingApprovalGranted(
        uint256 indexed invoiceId,
        address indexed operator,
        uint64 approvedAt
    );

    /// @notice Emitted when an invoice is funded
    event InvoiceFunded(
        uint256 indexed invoiceId,
        address indexed supplier,
        uint128 fundingAmount,
        uint128 discount,
        uint64 fundedAt
    );

    /// @notice Emitted when an invoice is repaid
    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed buyer,
        uint128 amountPaid,
        uint64 paidAt
    );

    /// @notice Emitted when an invoice is cancelled
    event InvoiceCancelled(
        uint256 indexed invoiceId,
        address indexed cancelledBy,
        uint64 cancelledAt
    );

    /// @notice Emitted when an invoice is marked as defaulted
    event InvoiceDefaulted(
        uint256 indexed invoiceId,
        uint64 defaultedAt
    );

    /// @notice Emitted when ExecutionPool is updated
    event ExecutionPoolUpdated(address indexed oldPool, address indexed newPool);

    /// @notice Emitted when LiquidityPool is updated
    event LiquidityPoolUpdated(address indexed oldPool, address indexed newPool);

    /// @notice Emitted when USDC address is updated
    event USDCUpdated(address indexed oldUsdc, address indexed newUsdc);

    /// @notice Emitted when operator status changes
    event OperatorUpdated(address indexed operator, bool status);

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    /// @notice Invoice does not exist
    error InvoiceNotFound(uint256 invoiceId);

    /// @notice Invalid invoice status for operation
    error InvalidInvoiceStatus(uint256 invoiceId, LibInvoiceStorage.InvoiceStatus expected, LibInvoiceStorage.InvoiceStatus actual);

    /// @notice Caller is not authorized
    error Unauthorized(address caller, string role);

    /// @notice Invalid parameter value
    error InvalidParameter(string param);

    /// @notice Zero address not allowed
    error ZeroAddress();

    /// @notice Zero amount not allowed
    error ZeroAmount();

    /// @notice Insufficient funds for operation
    error InsufficientFunds(uint256 required, uint256 available);

    /// @notice Invoice already exists with external ID
    error DuplicateExternalId(bytes32 externalId);

    /// @notice Maturity date must be in the future
    error MaturityInPast(uint64 maturityDate);

    /// @notice Discount rate too high
    error DiscountRateTooHigh(uint16 rate);

    /// @notice Buyer cannot be supplier
    error BuyerCannotBeSupplier();

    // ============ InvoiceFacet Functions ============

    /// @notice Create a new invoice
    /// @param buyer Address of the buyer
    /// @param faceValue Full invoice amount (USDC, 6 decimals)
    /// @param discountRateBps Annual discount rate in basis points
    /// @param maturityDate Unix timestamp when payment is due
    /// @param invoiceHash IPFS CID or document hash
    /// @param externalId External reference number
    /// @return invoiceId The created invoice ID
    function createInvoice(
        address buyer,
        uint128 faceValue,
        uint16 discountRateBps,
        uint64 maturityDate,
        bytes32 invoiceHash,
        bytes32 externalId
    ) external returns (uint256 invoiceId);

    /// @notice Approve an invoice (buyer only)
    /// @param invoiceId The invoice ID to approve
    function approveInvoice(uint256 invoiceId) external;

    /// @notice Cancel a pending invoice
    /// @param invoiceId The invoice ID to cancel
    function cancelInvoice(uint256 invoiceId) external;

    // ============ FundingFacet Functions ============

    /// @notice Approve funding for an invoice (operator approval step)
    /// @param invoiceId The invoice ID to approve funding for
    function approveFunding(uint256 invoiceId) external;

    /// @notice Batch approve funding for multiple invoices
    /// @param invoiceIds Array of invoice IDs to approve funding for
    function batchApproveFunding(uint256[] calldata invoiceIds) external;

    /// @notice Check if an invoice can have its funding approved
    /// @param invoiceId The invoice ID to check
    /// @return canApprove True if invoice can have funding approved
    function canApproveFunding(uint256 invoiceId) external view returns (bool canApprove);

    /// @notice Request funding for a funding-approved invoice
    /// @param invoiceId The invoice ID to fund
    function requestFunding(uint256 invoiceId) external;

    /// @notice Batch fund multiple funding-approved invoices
    /// @param invoiceIds Array of invoice IDs to fund
    function batchFund(uint256[] calldata invoiceIds) external;

    /// @notice Check if an invoice can be funded
    /// @param invoiceId The invoice ID to check
    /// @return canFund True if invoice can be funded
    function canFundInvoice(uint256 invoiceId) external view returns (bool canFund);

    /// @notice Get the funding amount for an invoice
    /// @param invoiceId The invoice ID
    /// @return amount The funding amount (after discount)
    function getFundingAmount(uint256 invoiceId) external view returns (uint128 amount);

    // ============ RepaymentFacet Functions ============

    /// @notice Process repayment for a funded invoice (buyer only)
    /// @param invoiceId The invoice ID to repay
    function processRepayment(uint256 invoiceId) external;

    /// @notice Get repayment amount for an invoice
    /// @param invoiceId The invoice ID
    /// @return amount The repayment amount (face value)
    function getRepaymentAmount(uint256 invoiceId) external view returns (uint128 amount);

    /// @notice Check if an invoice is overdue
    /// @param invoiceId The invoice ID
    /// @return overdue True if overdue
    function isOverdue(uint256 invoiceId) external view returns (bool overdue);

    /// @notice Mark an invoice as defaulted (operator only)
    /// @param invoiceId The invoice ID to default
    function markDefaulted(uint256 invoiceId) external;

    // ============ ViewFacet Functions ============

    /// @notice Get invoice details
    /// @param invoiceId The invoice ID
    /// @return invoice The invoice data
    function getInvoice(uint256 invoiceId) external view returns (InvoiceView memory invoice);

    /// @notice Get invoices for a supplier
    /// @param supplier The supplier address
    /// @return invoiceIds Array of invoice IDs
    function getSupplierInvoices(address supplier) external view returns (uint256[] memory invoiceIds);

    /// @notice Get invoices for a buyer
    /// @param buyer The buyer address
    /// @return invoiceIds Array of invoice IDs
    function getBuyerInvoices(address buyer) external view returns (uint256[] memory invoiceIds);

    /// @notice Get pending approvals for a buyer
    /// @param buyer The buyer address
    /// @return invoiceIds Array of pending invoice IDs
    function getPendingApprovals(address buyer) external view returns (uint256[] memory invoiceIds);

    /// @notice Get upcoming repayments for a buyer
    /// @param buyer The buyer address
    /// @return invoiceIds Array of funded invoice IDs
    function getUpcomingRepayments(address buyer) external view returns (uint256[] memory invoiceIds);

    /// @notice Get invoices awaiting operator funding approval (Approved status)
    /// @return invoiceIds Array of invoice IDs awaiting funding approval
    function getAwaitingFundingApproval() external view returns (uint256[] memory invoiceIds);

    /// @notice Get invoices ready for funding (FundingApproved status)
    /// @return invoiceIds Array of invoice IDs ready for funding
    function getReadyForFunding() external view returns (uint256[] memory invoiceIds);

    /// @notice Get aggregate statistics
    /// @return totalFunded Total USDC funded
    /// @return totalRepaid Total USDC repaid
    /// @return activeCount Number of active invoices
    /// @return nextId Next invoice ID
    function getStats() external view returns (
        uint256 totalFunded,
        uint256 totalRepaid,
        uint256 activeCount,
        uint256 nextId
    );

    /// @notice Get contract addresses
    /// @return executionPool ExecutionPool address
    /// @return liquidityPool LiquidityPool address
    /// @return usdc USDC address
    function getContractAddresses() external view returns (
        address executionPool,
        address liquidityPool,
        address usdc
    );

    // ============ Admin Functions ============

    /// @notice Set ExecutionPool address
    /// @param _executionPool New ExecutionPool address
    function setExecutionPool(address _executionPool) external;

    /// @notice Set LiquidityPool address
    /// @param _liquidityPool New LiquidityPool address
    function setLiquidityPool(address _liquidityPool) external;

    /// @notice Set USDC address
    /// @param _usdc New USDC address
    function setUSDC(address _usdc) external;

    /// @notice Set operator status
    /// @param operator Address to set
    /// @param status True to grant, false to revoke
    function setOperator(address operator, bool status) external;

    /// @notice Check if address is operator
    /// @param addr Address to check
    /// @return isOp True if operator
    function isOperator(address addr) external view returns (bool isOp);

    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external;

    /// @notice Get current owner
    /// @return owner Owner address
    function owner() external view returns (address);
}
