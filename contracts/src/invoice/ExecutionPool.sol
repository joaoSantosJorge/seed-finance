// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ExecutionPool
 * @notice USDC holding and execution for invoice funding on Base
 * @dev Receives USDC from LiquidityPool, funds invoices to suppliers,
 *      processes repayments from buyers, and returns capital to LiquidityPool
 *
 * Flow:
 * 1. Operator calls fundInvoice(invoiceId)
 * 2. ExecutionPool pulls USDC from LiquidityPool via deployForFunding()
 * 3. ExecutionPool transfers USDC to supplier
 * 4. At maturity, buyer repays to ExecutionPool via repayInvoice()
 * 5. ExecutionPool returns principal + yield to LiquidityPool
 */
contract ExecutionPool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Roles ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DIAMOND_ROLE = keccak256("DIAMOND_ROLE");

    // ============ State Variables ============

    /// @notice USDC token address
    IERC20 public immutable usdc;

    /// @notice LiquidityPool contract address
    address public liquidityPool;

    /// @notice InvoiceDiamond contract address
    address public invoiceDiamond;

    /// @notice Total USDC funded to suppliers
    uint256 public totalFunded;

    /// @notice Total USDC repaid by buyers
    uint256 public totalRepaid;

    /// @notice Number of active (funded, not yet paid) invoices
    uint256 public activeInvoices;

    /// @notice Mapping of invoice ID to funding data
    mapping(uint256 => FundingRecord) public fundingRecords;

    // ============ Structs ============

    struct FundingRecord {
        address supplier;
        uint128 fundingAmount;
        uint128 faceValue;
        uint64 fundedAt;
        bool funded;
        bool repaid;
    }

    // ============ Events ============

    event InvoiceFunded(
        uint256 indexed invoiceId,
        address indexed supplier,
        uint256 amount
    );

    event RepaymentReceived(
        uint256 indexed invoiceId,
        address indexed buyer,
        uint256 amount
    );

    event YieldReturned(
        uint256 indexed invoiceId,
        uint256 principal,
        uint256 yield
    );

    event LiquidityPoolUpdated(address indexed oldPool, address indexed newPool);
    event InvoiceDiamondUpdated(address indexed oldDiamond, address indexed newDiamond);

    // ============ Errors ============

    error ZeroAddress();
    error ZeroAmount();
    error InvoiceAlreadyFunded(uint256 invoiceId);
    error InvoiceNotFunded(uint256 invoiceId);
    error InvoiceAlreadyRepaid(uint256 invoiceId);
    error LiquidityPoolNotSet();
    error InsufficientFunds(uint256 required, uint256 available);
    error TransferFailed();

    // ============ Constructor ============

    /**
     * @notice Initialize the ExecutionPool
     * @param _usdc USDC token address
     */
    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ============ Configuration ============

    /**
     * @notice Set the LiquidityPool address
     * @param _liquidityPool New LiquidityPool address
     */
    function setLiquidityPool(address _liquidityPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_liquidityPool == address(0)) revert ZeroAddress();
        address oldPool = liquidityPool;
        liquidityPool = _liquidityPool;
        emit LiquidityPoolUpdated(oldPool, _liquidityPool);
    }

    /**
     * @notice Set the InvoiceDiamond address
     * @param _invoiceDiamond New InvoiceDiamond address
     */
    function setInvoiceDiamond(address _invoiceDiamond) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_invoiceDiamond == address(0)) revert ZeroAddress();
        address oldDiamond = invoiceDiamond;
        invoiceDiamond = _invoiceDiamond;

        // Grant DIAMOND_ROLE to new diamond
        if (oldDiamond != address(0)) {
            _revokeRole(DIAMOND_ROLE, oldDiamond);
        }
        _grantRole(DIAMOND_ROLE, _invoiceDiamond);

        emit InvoiceDiamondUpdated(oldDiamond, _invoiceDiamond);
    }

    // ============ Funding Functions ============

    /**
     * @notice Fund an approved invoice
     * @dev Pulls USDC from LiquidityPool and transfers to supplier
     * @param invoiceId The invoice ID to fund
     * @param supplier Address of the supplier to receive funds
     * @param fundingAmount Amount to fund (after discount)
     * @param faceValue Full invoice amount (for repayment tracking)
     */
    function fundInvoice(
        uint256 invoiceId,
        address supplier,
        uint128 fundingAmount,
        uint128 faceValue
    ) external nonReentrant {
        // Allow operators OR the supplier themselves to fund
        require(
            hasRole(OPERATOR_ROLE, msg.sender) || supplier == msg.sender,
            "Unauthorized: not operator or supplier"
        );
        // Validate
        if (supplier == address(0)) revert ZeroAddress();
        if (fundingAmount == 0) revert ZeroAmount();
        if (fundingRecords[invoiceId].funded) revert InvoiceAlreadyFunded(invoiceId);
        if (liquidityPool == address(0)) revert LiquidityPoolNotSet();

        // Pull USDC from LiquidityPool
        bool success = ILiquidityPool(liquidityPool).deployForFunding(fundingAmount, invoiceId);
        if (!success) revert TransferFailed();

        // Record funding
        fundingRecords[invoiceId] = FundingRecord({
            supplier: supplier,
            fundingAmount: fundingAmount,
            faceValue: faceValue,
            fundedAt: uint64(block.timestamp),
            funded: true,
            repaid: false
        });

        // Update stats
        totalFunded += fundingAmount;
        activeInvoices++;

        // Transfer to supplier
        usdc.safeTransfer(supplier, fundingAmount);

        emit InvoiceFunded(invoiceId, supplier, fundingAmount);
    }

    /**
     * @notice Receive repayment from buyer
     * @dev Called by InvoiceDiamond after buyer approves and transfers USDC
     * @param invoiceId The invoice being repaid
     * @param buyer Address of the buyer making repayment
     */
    function receiveRepayment(
        uint256 invoiceId,
        address buyer
    ) external nonReentrant {
        // Can be called by operator or diamond
        require(
            hasRole(OPERATOR_ROLE, msg.sender) || hasRole(DIAMOND_ROLE, msg.sender),
            "Unauthorized"
        );

        FundingRecord storage record = fundingRecords[invoiceId];

        // Validate
        if (!record.funded) revert InvoiceNotFunded(invoiceId);
        if (record.repaid) revert InvoiceAlreadyRepaid(invoiceId);

        uint256 repaymentAmount = record.faceValue;
        uint256 principal = record.fundingAmount;
        uint256 yield = repaymentAmount - principal;

        // Mark as repaid
        record.repaid = true;

        // Update stats
        totalRepaid += repaymentAmount;
        activeInvoices--;

        // Transfer repayment amount from caller (Diamond or buyer) to this contract
        // Note: Caller should have already transferred USDC to this contract
        // or we pull from the diamond
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < repaymentAmount) {
            // Try to pull from caller
            usdc.safeTransferFrom(msg.sender, address(this), repaymentAmount);
        }

        // Return to LiquidityPool
        if (liquidityPool != address(0)) {
            usdc.safeTransfer(liquidityPool, repaymentAmount);
            ILiquidityPool(liquidityPool).receiveRepayment(principal, yield, invoiceId);
        }

        emit RepaymentReceived(invoiceId, buyer, repaymentAmount);
        emit YieldReturned(invoiceId, principal, yield);
    }

    /**
     * @notice Process direct repayment from buyer
     * @dev Buyer calls this directly with USDC allowance set
     * @param invoiceId The invoice being repaid
     */
    function repayInvoice(uint256 invoiceId) external nonReentrant {
        FundingRecord storage record = fundingRecords[invoiceId];

        // Validate
        if (!record.funded) revert InvoiceNotFunded(invoiceId);
        if (record.repaid) revert InvoiceAlreadyRepaid(invoiceId);

        uint256 repaymentAmount = record.faceValue;
        uint256 principal = record.fundingAmount;
        uint256 yield = repaymentAmount - principal;

        // Mark as repaid
        record.repaid = true;

        // Update stats
        totalRepaid += repaymentAmount;
        activeInvoices--;

        // Transfer USDC from buyer
        usdc.safeTransferFrom(msg.sender, address(this), repaymentAmount);

        // Return to LiquidityPool
        if (liquidityPool != address(0)) {
            usdc.safeTransfer(liquidityPool, repaymentAmount);
            ILiquidityPool(liquidityPool).receiveRepayment(principal, yield, invoiceId);
        }

        emit RepaymentReceived(invoiceId, msg.sender, repaymentAmount);
        emit YieldReturned(invoiceId, principal, yield);
    }

    // ============ View Functions ============

    /**
     * @notice Get available USDC balance
     */
    function availableBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get funding record for an invoice
     * @param invoiceId The invoice ID
     */
    function getFundingRecord(uint256 invoiceId) external view returns (FundingRecord memory) {
        return fundingRecords[invoiceId];
    }

    /**
     * @notice Check if an invoice has been funded
     * @param invoiceId The invoice ID
     */
    function isInvoiceFunded(uint256 invoiceId) external view returns (bool) {
        return fundingRecords[invoiceId].funded;
    }

    /**
     * @notice Check if an invoice has been repaid
     * @param invoiceId The invoice ID
     */
    function isInvoiceRepaid(uint256 invoiceId) external view returns (bool) {
        return fundingRecords[invoiceId].repaid;
    }

    /**
     * @notice Get total stats
     */
    function getStats() external view returns (
        uint256 _totalFunded,
        uint256 _totalRepaid,
        uint256 _activeInvoices
    ) {
        return (totalFunded, totalRepaid, activeInvoices);
    }
}

/**
 * @title ILiquidityPool
 * @notice Interface for LiquidityPool used by ExecutionPool
 */
interface ILiquidityPool {
    function deployForFunding(uint256 amount, uint256 invoiceId) external returns (bool);
    function receiveRepayment(uint256 principal, uint256 yield, uint256 invoiceId) external;
}
