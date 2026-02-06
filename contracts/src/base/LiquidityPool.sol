// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../interfaces/ITreasuryStrategy.sol";

/**
 * @title SeedFinance Liquidity Pool
 * @notice ERC-4626 vault for USDC deposits on Arc
 * @dev LPs deposit USDC, receive SEED shares, earn yield from:
 *
 * Arc Chain Note: On Arc, USDC is the native gas token with 18 decimals at the
 * protocol level, but the ERC-20 interface at 0x3600000000000000000000000000000000000000
 * uses 6 decimals. This contract interacts via the ERC-20 interface only, so all amounts
 * remain in 6-decimal precision. Do NOT use msg.value for USDC transfers on Arc.
 *
 *      1. Invoice financing spreads (primary)
 *      2. Treasury strategies on idle capital (secondary)
 *
 * Architecture:
 * - Deposited USDC can be in three states:
 *   a) Available: Sitting in this contract, ready for invoice funding
 *   b) Deployed: Funding active invoices
 *   c) In Treasury: Earning yield via TreasuryManager strategies
 *
 * - totalAssets() = available + deployed + treasuryValue
 * - Share price increases as yield is earned from both sources
 */
contract LiquidityPool is ERC4626, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Roles ============
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ State Variables ============

    /// @notice Amount of USDC currently deployed for invoice funding
    uint256 public totalDeployed;

    /// @notice Amount of USDC currently in treasury strategies
    uint256 public totalInTreasury;

    /// @notice Cumulative yield earned from invoice financing
    uint256 public totalInvoiceYield;

    /// @notice Cumulative yield earned from treasury strategies
    uint256 public totalTreasuryYield;

    /// @notice Address of the TreasuryManager contract
    address public treasuryManager;

    /// @notice Minimum liquidity buffer to keep available (not in treasury)
    /// @dev Ensures we can fund invoices without waiting for treasury withdrawals
    uint256 public liquidityBuffer;

    /// @notice Maximum percentage of idle capital to deploy to treasury (basis points)
    /// @dev 8000 = 80% max to treasury, 20% always liquid
    uint256 public maxTreasuryAllocation;

    // ============ Events ============

    event LiquidityDeployed(uint256 indexed invoiceId, uint256 amount);
    event LiquidityReturned(uint256 indexed invoiceId, uint256 principal, uint256 yield);
    event TreasuryDeposit(uint256 amount, uint256 newTreasuryBalance);
    event TreasuryWithdraw(uint256 amount, uint256 received, uint256 newTreasuryBalance);
    event TreasuryYieldAccrued(uint256 amount);
    event TreasuryManagerUpdated(address indexed oldManager, address indexed newManager);
    event LiquidityBufferUpdated(uint256 oldBuffer, uint256 newBuffer);
    event MaxTreasuryAllocationUpdated(uint256 oldAllocation, uint256 newAllocation);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ============ Errors ============

    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InvalidTreasuryManager();
    error TreasuryManagerNotSet();
    error InvalidAllocation();
    error ZeroAmount();
    error ZeroAddress();

    // ============ Constructor ============

    /**
     * @notice Initialize the liquidity pool
     * @param _usdc USDC token address on Base
     * @param _name Share token name (e.g., "Seed")
     * @param _symbol Share token symbol (e.g., "SEED")
     */
    constructor(
        IERC20 _usdc,
        string memory _name,
        string memory _symbol
    ) ERC4626(_usdc) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        // Default: keep 100k USDC buffer, max 80% to treasury
        liquidityBuffer = 100_000 * 1e6; // 100k USDC (6 decimals)
        maxTreasuryAllocation = 8000; // 80%
    }

    // ============ ERC-4626 Overrides ============

    /**
     * @notice Total assets under management
     * @dev Includes: available balance + deployed for invoices + treasury value
     */
    function totalAssets() public view override returns (uint256) {
        uint256 available = IERC20(asset()).balanceOf(address(this));
        uint256 treasuryValue = _getTreasuryValue();
        return available + totalDeployed + treasuryValue;
    }

    /**
     * @notice Deposit USDC and receive SEED shares
     * @dev Overridden to add pausable check
     */
    function deposit(
        uint256 assets,
        address receiver
    ) public override nonReentrant whenNotPaused returns (uint256) {
        return super.deposit(assets, receiver);
    }

    /**
     * @notice Mint specific amount of shares
     * @dev Overridden to add pausable check
     */
    function mint(
        uint256 shares,
        address receiver
    ) public override nonReentrant whenNotPaused returns (uint256) {
        return super.mint(shares, receiver);
    }

    /**
     * @notice Withdraw USDC by specifying asset amount
     * @dev May need to pull from treasury if insufficient liquid balance
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant whenNotPaused returns (uint256) {
        // Ensure we have enough liquidity
        _ensureLiquidity(assets);
        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @notice Redeem shares for USDC
     * @dev May need to pull from treasury if insufficient liquid balance
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant whenNotPaused returns (uint256) {
        uint256 assets = previewRedeem(shares);
        _ensureLiquidity(assets);
        return super.redeem(shares, receiver, owner);
    }

    // ============ Invoice Funding Functions ============

    /**
     * @notice Deploy USDC for invoice funding
     * @param amount Amount of USDC to deploy
     * @param invoiceId Invoice ID being funded
     * @dev Called by ExecutionPool via PaymentRouter (ROUTER_ROLE)
     */
    function deployForFunding(
        uint256 amount,
        uint256 invoiceId
    ) external onlyRole(ROUTER_ROLE) nonReentrant returns (bool) {
        if (amount == 0) revert ZeroAmount();

        uint256 available = availableLiquidity();

        // If not enough liquid, pull from treasury
        if (available < amount) {
            uint256 needed = amount - available;
            _withdrawFromTreasury(needed);
        }

        // Verify we now have enough
        available = availableLiquidity();
        if (available < amount) {
            revert InsufficientLiquidity(amount, available);
        }

        totalDeployed += amount;

        // Transfer USDC to caller (ExecutionPool)
        IERC20(asset()).safeTransfer(msg.sender, amount);

        emit LiquidityDeployed(invoiceId, amount);
        return true;
    }

    /**
     * @notice Receive repayment from invoice
     * @param principal Original amount deployed
     * @param yield Earned yield (faceValue - fundingAmount)
     * @param invoiceId Associated invoice
     * @dev Called by ExecutionPool after buyer repayment
     */
    function receiveRepayment(
        uint256 principal,
        uint256 yield,
        uint256 invoiceId
    ) external onlyRole(ROUTER_ROLE) nonReentrant {
        // USDC should already be transferred to this contract
        totalDeployed -= principal;
        totalInvoiceYield += yield;

        emit LiquidityReturned(invoiceId, principal, yield);

        // Optionally rebalance to treasury after receiving funds
        _autoRebalanceToTreasury();
    }

    // ============ Treasury Integration ============

    /**
     * @notice Deposit idle USDC to treasury strategies
     * @param amount Amount to deposit
     * @dev Can be called by TREASURY_ROLE or automatically
     */
    function depositToTreasury(uint256 amount) external onlyRole(TREASURY_ROLE) nonReentrant {
        _depositToTreasury(amount);
    }

    /**
     * @notice Withdraw USDC from treasury strategies
     * @param amount Amount to withdraw
     * @dev Called when liquidity is needed for funding or withdrawals
     */
    function withdrawFromTreasury(uint256 amount) external onlyRole(TREASURY_ROLE) nonReentrant {
        _withdrawFromTreasury(amount);
    }

    /**
     * @notice Accrue yield from treasury strategies
     * @dev Called periodically to update totalAssets with earned yield
     */
    function accrueTreasuryYield() external nonReentrant {
        if (treasuryManager == address(0)) return;

        uint256 currentValue = _getTreasuryValue();
        if (currentValue > totalInTreasury) {
            uint256 yield = currentValue - totalInTreasury;
            totalInTreasury = currentValue;
            totalTreasuryYield += yield;
            emit TreasuryYieldAccrued(yield);
        }
    }

    /**
     * @notice Trigger rebalancing to treasury based on current allocation
     * @dev Moves excess liquid funds to treasury strategies
     */
    function rebalanceToTreasury() external onlyRole(TREASURY_ROLE) nonReentrant {
        _autoRebalanceToTreasury();
    }

    // ============ View Functions ============

    /**
     * @notice Available liquidity for immediate use
     * @return Amount of USDC available (not deployed or in treasury)
     */
    function availableLiquidity() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /**
     * @notice Total liquidity including treasury
     * @return Available + treasury value (excludes deployed)
     */
    function totalAvailableLiquidity() public view returns (uint256) {
        return availableLiquidity() + _getTreasuryValue();
    }

    /**
     * @notice Current utilization rate
     * @return Utilization in basis points (deployed / totalAssets)
     */
    function utilizationRate() public view returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;
        return (totalDeployed * 10000) / total;
    }

    /**
     * @notice Current treasury allocation rate
     * @return Treasury allocation in basis points
     */
    function treasuryAllocationRate() public view returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;
        return (_getTreasuryValue() * 10000) / total;
    }

    /**
     * @notice Get treasury value from TreasuryManager
     */
    function getTreasuryValue() external view returns (uint256) {
        return _getTreasuryValue();
    }

    /**
     * @notice Calculate optimal treasury deposit amount
     * @return Amount that could be deposited to treasury
     */
    function getOptimalTreasuryDeposit() public view returns (uint256) {
        uint256 available = availableLiquidity();
        if (available <= liquidityBuffer) return 0;

        uint256 excess = available - liquidityBuffer;
        uint256 totalAssets_ = totalAssets();
        uint256 currentTreasuryValue = _getTreasuryValue();

        // Calculate max treasury value based on allocation
        uint256 maxTreasuryValue = (totalAssets_ * maxTreasuryAllocation) / 10000;

        if (currentTreasuryValue >= maxTreasuryValue) return 0;

        uint256 canDeposit = maxTreasuryValue - currentTreasuryValue;
        return excess < canDeposit ? excess : canDeposit;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the TreasuryManager contract address
     * @param _treasuryManager New TreasuryManager address
     */
    function setTreasuryManager(address _treasuryManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasuryManager == address(0)) revert ZeroAddress();

        address oldManager = treasuryManager;
        treasuryManager = _treasuryManager;

        // Approve TreasuryManager to pull USDC
        IERC20(asset()).approve(_treasuryManager, type(uint256).max);

        emit TreasuryManagerUpdated(oldManager, _treasuryManager);
    }

    /**
     * @notice Set the minimum liquidity buffer
     * @param _buffer New buffer amount in USDC
     */
    function setLiquidityBuffer(uint256 _buffer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldBuffer = liquidityBuffer;
        liquidityBuffer = _buffer;
        emit LiquidityBufferUpdated(oldBuffer, _buffer);
    }

    /**
     * @notice Set maximum treasury allocation
     * @param _maxAllocation New max allocation in basis points (max 10000)
     */
    function setMaxTreasuryAllocation(uint256 _maxAllocation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_maxAllocation > 10000) revert InvalidAllocation();
        uint256 oldAllocation = maxTreasuryAllocation;
        maxTreasuryAllocation = _maxAllocation;
        emit MaxTreasuryAllocationUpdated(oldAllocation, _maxAllocation);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw any token
     * @param token Token address (use address(0) for ETH)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();

        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, amount, to);
    }

    // ============ Internal Functions ============

    /**
     * @notice Get current treasury value from TreasuryManager
     */
    function _getTreasuryValue() internal view returns (uint256) {
        if (treasuryManager == address(0)) return 0;

        // TreasuryManager tracks our deposits and their current value
        try ITreasuryManager(treasuryManager).totalValue() returns (uint256 value) {
            return value;
        } catch {
            return totalInTreasury; // Fallback to tracked value
        }
    }

    /**
     * @notice Deposit to treasury strategies
     */
    function _depositToTreasury(uint256 amount) internal {
        if (treasuryManager == address(0)) revert TreasuryManagerNotSet();
        if (amount == 0) revert ZeroAmount();

        uint256 available = availableLiquidity();
        if (available < amount) revert InsufficientLiquidity(amount, available);

        // TreasuryManager pulls funds via transferFrom (we approved it in setTreasuryManager)
        // No need to transfer first - TM will pull when deposit() is called
        ITreasuryManager(treasuryManager).deposit(amount);

        totalInTreasury += amount;
        emit TreasuryDeposit(amount, totalInTreasury);
    }

    /**
     * @notice Withdraw from treasury strategies
     */
    function _withdrawFromTreasury(uint256 amount) internal {
        if (treasuryManager == address(0)) revert TreasuryManagerNotSet();
        if (amount == 0) revert ZeroAmount();

        uint256 treasuryValue = _getTreasuryValue();
        uint256 toWithdraw = amount > treasuryValue ? treasuryValue : amount;

        if (toWithdraw == 0) return;

        // Withdraw from treasury manager
        uint256 received = ITreasuryManager(treasuryManager).withdraw(toWithdraw);

        // Update tracking (may have earned yield)
        if (received > toWithdraw) {
            totalTreasuryYield += (received - toWithdraw);
        }
        totalInTreasury = totalInTreasury > toWithdraw ? totalInTreasury - toWithdraw : 0;

        emit TreasuryWithdraw(toWithdraw, received, totalInTreasury);
    }

    /**
     * @notice Ensure sufficient liquidity, pulling from treasury if needed
     */
    function _ensureLiquidity(uint256 amount) internal {
        uint256 available = availableLiquidity();
        if (available >= amount) return;

        uint256 needed = amount - available;
        if (treasuryManager != address(0)) {
            _withdrawFromTreasury(needed);
        }

        // Final check
        available = availableLiquidity();
        if (available < amount) {
            revert InsufficientLiquidity(amount, available);
        }
    }

    /**
     * @notice Automatically deposit excess liquidity to treasury
     */
    function _autoRebalanceToTreasury() internal {
        if (treasuryManager == address(0)) return;

        uint256 optimalDeposit = getOptimalTreasuryDeposit();
        if (optimalDeposit > 0) {
            _depositToTreasury(optimalDeposit);
        }
    }

    // ============ Receive ETH ============

    receive() external payable {}
}

/**
 * @title ITreasuryManager
 * @notice Interface for TreasuryManager used by LiquidityPool
 */
interface ITreasuryManager {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external returns (uint256);
    function totalValue() external view returns (uint256);
}
