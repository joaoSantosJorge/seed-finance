// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/ITreasuryStrategy.sol";

/**
 * @title BaseTreasuryStrategy
 * @notice Abstract base contract for treasury strategies
 * @dev Inherit from this contract to implement new yield strategies
 *
 * Implementation Guide:
 * 1. Inherit from BaseTreasuryStrategy
 * 2. Implement _deposit() - logic to deposit into yield source
 * 3. Implement _withdraw() - logic to withdraw from yield source
 * 4. Implement _totalValue() - calculate current value in asset terms
 * 5. Override other functions as needed for your specific protocol
 *
 * Example implementations:
 * - USYCStrategy: Hashnote Treasury
 * - AaveStrategy: Aave lending pool
 * - CompoundStrategy: Compound lending
 * - YearnStrategy: Yearn vaults
 * - MorphoStrategy: Morpho optimized lending
 */
abstract contract BaseTreasuryStrategy is ITreasuryStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The underlying asset (e.g., USDC)
    IERC20 public immutable _asset;

    /// @notice Strategy name for identification
    string internal _name;

    /// @notice Address of the TreasuryManager
    address public treasuryManager;

    /// @notice Whether the strategy is currently active
    bool public override isActive;

    /// @notice Estimated APY in basis points
    uint256 public override estimatedAPY;

    /// @notice Total amount deposited (for tracking)
    uint256 public totalDeposited;

    // ============ Events ============

    event TreasuryManagerUpdated(address indexed oldManager, address indexed newManager);
    event EstimatedAPYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============ Errors ============

    error OnlyTreasuryManager();
    error StrategyNotActive();
    error ZeroAmount();
    error ZeroAddress();

    // ============ Modifiers ============

    /**
     * @notice Restrict to TreasuryManager only
     */
    modifier onlyManager() {
        if (msg.sender != treasuryManager) revert OnlyTreasuryManager();
        _;
    }

    /**
     * @notice Only when strategy is active
     */
    modifier whenActive() {
        if (!isActive) revert StrategyNotActive();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize base strategy
     * @param asset_ Underlying asset address
     * @param name_ Strategy name
     * @param treasuryManager_ TreasuryManager address
     * @param initialAPY Initial APY estimate in basis points
     */
    constructor(
        address asset_,
        string memory name_,
        address treasuryManager_,
        uint256 initialAPY
    ) Ownable(msg.sender) {
        if (asset_ == address(0)) revert ZeroAddress();
        if (treasuryManager_ == address(0)) revert ZeroAddress();

        _asset = IERC20(asset_);
        _name = name_;
        treasuryManager = treasuryManager_;
        estimatedAPY = initialAPY;
        isActive = true;
    }

    // ============ ITreasuryStrategy Implementation ============

    /**
     * @notice Deposit assets into the strategy
     */
    function deposit(
        uint256 amount
    ) external override onlyManager whenActive nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        // Transfer from TreasuryManager
        _asset.safeTransferFrom(msg.sender, address(this), amount);

        // Execute strategy-specific deposit
        shares = _deposit(amount);

        totalDeposited += amount;

        emit Deposited(msg.sender, amount, shares);
    }

    /**
     * @notice Withdraw assets from the strategy
     */
    function withdraw(
        uint256 amount
    ) external override onlyManager nonReentrant returns (uint256 received) {
        if (amount == 0) revert ZeroAmount();

        // Execute strategy-specific withdrawal
        received = _withdraw(amount);

        // Update tracking
        if (received >= totalDeposited) {
            totalDeposited = 0;
        } else {
            totalDeposited -= received;
        }

        // Transfer to TreasuryManager
        _asset.safeTransfer(msg.sender, received);

        emit Withdrawn(msg.sender, amount, received);
    }

    /**
     * @notice Withdraw all assets from the strategy
     */
    function withdrawAll() external override onlyManager nonReentrant returns (uint256 received) {
        received = _withdrawAll();

        totalDeposited = 0;

        // Transfer to TreasuryManager
        if (received > 0) {
            _asset.safeTransfer(msg.sender, received);
        }

        emit Withdrawn(msg.sender, received, received);
    }

    /**
     * @notice Get total value in asset terms
     */
    function totalValue() external view override returns (uint256) {
        return _totalValue();
    }

    /**
     * @notice Get the underlying asset address
     */
    function asset() external view override returns (address) {
        return address(_asset);
    }

    /**
     * @notice Get strategy name
     */
    function name() external view override returns (string memory) {
        return _name;
    }

    /**
     * @notice Check if instant withdrawals supported
     * @dev Override in derived contracts if different
     */
    function supportsInstantWithdraw() external view virtual override returns (bool) {
        return true;
    }

    /**
     * @notice Get max instant withdrawal amount
     * @dev Override in derived contracts if different
     */
    function maxInstantWithdraw() external view virtual override returns (uint256) {
        return _totalValue();
    }

    // ============ Abstract Functions ============

    /**
     * @notice Strategy-specific deposit logic
     * @param amount Amount to deposit
     * @return shares Shares/tokens received (if applicable)
     */
    function _deposit(uint256 amount) internal virtual returns (uint256 shares);

    /**
     * @notice Strategy-specific withdrawal logic
     * @param amount Amount to withdraw
     * @return received Actual amount received
     */
    function _withdraw(uint256 amount) internal virtual returns (uint256 received);

    /**
     * @notice Strategy-specific withdraw all logic
     * @return received Total amount received
     */
    function _withdrawAll() internal virtual returns (uint256 received);

    /**
     * @notice Get current total value in asset terms
     * @return Current value including yield
     */
    function _totalValue() internal view virtual returns (uint256);

    // ============ Admin Functions ============

    /**
     * @notice Update TreasuryManager
     */
    function setTreasuryManager(address _treasuryManager) external onlyOwner {
        if (_treasuryManager == address(0)) revert ZeroAddress();

        address oldManager = treasuryManager;
        treasuryManager = _treasuryManager;

        emit TreasuryManagerUpdated(oldManager, _treasuryManager);
    }

    /**
     * @notice Update estimated APY
     */
    function setEstimatedAPY(uint256 _apy) external onlyOwner {
        uint256 oldAPY = estimatedAPY;
        estimatedAPY = _apy;
        emit EstimatedAPYUpdated(oldAPY, _apy);
    }

    /**
     * @notice Activate strategy
     */
    function activate() external onlyOwner {
        isActive = true;
        emit StrategyStatusChanged(true);
    }

    /**
     * @notice Deactivate strategy
     */
    function deactivate() external onlyOwner {
        isActive = false;
        emit StrategyStatusChanged(false);
    }

    /**
     * @notice Calculate yield earned
     */
    function yieldEarned() external view returns (uint256) {
        uint256 currentValue = _totalValue();
        if (currentValue > totalDeposited) {
            return currentValue - totalDeposited;
        }
        return 0;
    }

    /**
     * @notice Emergency withdraw to owner
     * @dev Override in derived contracts with specific logic
     */
    function emergencyWithdraw() external virtual onlyOwner nonReentrant {
        uint256 received = _withdrawAll();
        if (received > 0) {
            _asset.safeTransfer(owner(), received);
        }
        totalDeposited = 0;
        isActive = false;
    }

    /**
     * @notice Rescue stuck tokens (not the main asset)
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(_asset), "Cannot rescue main asset");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
