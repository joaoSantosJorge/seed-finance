// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../interfaces/ITreasuryStrategy.sol";

/**
 * @title TreasuryManager
 * @notice Manages idle capital across multiple yield strategies
 * @dev Designed for extensibility - new strategies can be added without contract upgrades
 *
 * Architecture:
 * - Receives USDC from LiquidityPool
 * - Allocates across multiple strategies based on configurable weights
 * - Supports instant withdrawal for invoice funding needs
 * - Strategies can be added, removed, or paused independently
 *
 * Strategy Pattern:
 * - All strategies implement ITreasuryStrategy
 * - Each strategy has a weight (allocation percentage)
 * - Deposits are distributed proportionally
 * - Withdrawals prioritize strategies with highest liquidity
 */
contract TreasuryManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Roles ============
    bytes32 public constant POOL_ROLE = keccak256("POOL_ROLE");
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ Structs ============

    struct StrategyInfo {
        address strategyAddress;
        uint256 weight;          // Allocation weight (basis points of total weight)
        uint256 deposited;       // Amount deposited to this strategy
        bool active;             // Can receive new deposits
        bool exists;             // Strategy is registered
        uint256 addedAt;         // Timestamp when added
        uint256 lastHarvest;     // Last yield harvest timestamp
    }

    // ============ State Variables ============

    /// @notice The underlying asset (USDC)
    IERC20 public immutable asset;

    /// @notice The LiquidityPool that owns this manager
    address public liquidityPool;

    /// @notice Array of all strategy addresses (for iteration)
    address[] public strategies;

    /// @notice Strategy info mapping
    mapping(address => StrategyInfo) public strategyInfo;

    /// @notice Total weight across all active strategies
    uint256 public totalWeight;

    /// @notice Maximum number of strategies allowed
    uint256 public constant MAX_STRATEGIES = 10;

    /// @notice Minimum time between rebalances (prevents MEV)
    uint256 public rebalanceCooldown = 1 hours;

    /// @notice Last rebalance timestamp
    uint256 public lastRebalance;

    /// @notice Slippage tolerance for withdrawals (basis points)
    uint256 public withdrawSlippageTolerance = 100; // 1%

    // ============ Events ============

    event StrategyAdded(address indexed strategy, uint256 weight, string name);
    event StrategyRemoved(address indexed strategy);
    event StrategyWeightUpdated(address indexed strategy, uint256 oldWeight, uint256 newWeight);
    event StrategyPaused(address indexed strategy);
    event StrategyUnpaused(address indexed strategy);
    event Deposited(uint256 amount, uint256 strategiesCount);
    event Withdrawn(uint256 requested, uint256 received);
    event StrategyDeposit(address indexed strategy, uint256 amount);
    event StrategyWithdraw(address indexed strategy, uint256 amount, uint256 received);
    event Rebalanced(uint256 timestamp);
    event YieldHarvested(address indexed strategy, uint256 yield);
    event LiquidityPoolUpdated(address indexed oldPool, address indexed newPool);
    event EmergencyWithdrawStrategy(address indexed strategy, uint256 received);

    // ============ Errors ============

    error StrategyAlreadyExists();
    error StrategyNotFound();
    error StrategyNotActive();
    error MaxStrategiesReached();
    error InvalidWeight();
    error ZeroAddress();
    error ZeroAmount();
    error OnlyLiquidityPool();
    error RebalanceCooldown();
    error WithdrawalSlippageExceeded(uint256 expected, uint256 received);
    error InsufficientFunds(uint256 requested, uint256 available);

    // ============ Modifiers ============

    modifier onlyPool() {
        if (msg.sender != liquidityPool) revert OnlyLiquidityPool();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the TreasuryManager
     * @param _asset USDC token address
     * @param _liquidityPool LiquidityPool contract address
     */
    constructor(address _asset, address _liquidityPool) {
        if (_asset == address(0)) revert ZeroAddress();
        if (_liquidityPool == address(0)) revert ZeroAddress();

        asset = IERC20(_asset);
        liquidityPool = _liquidityPool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_ROLE, _liquidityPool);
        _grantRole(STRATEGIST_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ Strategy Management ============

    /**
     * @notice Add a new treasury strategy
     * @param strategy Strategy contract address
     * @param weight Allocation weight in basis points
     */
    function addStrategy(
        address strategy,
        uint256 weight
    ) external onlyRole(STRATEGIST_ROLE) {
        if (strategy == address(0)) revert ZeroAddress();
        if (strategyInfo[strategy].exists) revert StrategyAlreadyExists();
        if (strategies.length >= MAX_STRATEGIES) revert MaxStrategiesReached();
        if (weight == 0) revert InvalidWeight();

        // Verify strategy implements interface
        require(
            ITreasuryStrategy(strategy).asset() == address(asset),
            "Strategy asset mismatch"
        );

        strategies.push(strategy);
        strategyInfo[strategy] = StrategyInfo({
            strategyAddress: strategy,
            weight: weight,
            deposited: 0,
            active: true,
            exists: true,
            addedAt: block.timestamp,
            lastHarvest: block.timestamp
        });

        totalWeight += weight;

        // Approve strategy to pull funds
        asset.approve(strategy, type(uint256).max);

        string memory name = ITreasuryStrategy(strategy).name();
        emit StrategyAdded(strategy, weight, name);
    }

    /**
     * @notice Remove a strategy (withdraws all funds first)
     * @param strategy Strategy address to remove
     */
    function removeStrategy(address strategy) external onlyRole(STRATEGIST_ROLE) nonReentrant {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();

        // Withdraw all funds from strategy
        if (info.deposited > 0) {
            uint256 received = ITreasuryStrategy(strategy).withdrawAll();
            // Transfer back to liquidity pool
            asset.safeTransfer(liquidityPool, received);
        }

        // Update total weight
        totalWeight -= info.weight;

        // Remove from array
        _removeStrategyFromArray(strategy);

        // Clear mapping
        delete strategyInfo[strategy];

        // Revoke approval
        asset.approve(strategy, 0);

        emit StrategyRemoved(strategy);
    }

    /**
     * @notice Update strategy weight
     * @param strategy Strategy address
     * @param newWeight New weight in basis points
     */
    function setStrategyWeight(
        address strategy,
        uint256 newWeight
    ) external onlyRole(STRATEGIST_ROLE) {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();
        if (newWeight == 0) revert InvalidWeight();

        uint256 oldWeight = info.weight;
        totalWeight = totalWeight - oldWeight + newWeight;
        info.weight = newWeight;

        emit StrategyWeightUpdated(strategy, oldWeight, newWeight);
    }

    /**
     * @notice Pause a strategy (no new deposits)
     * @param strategy Strategy address
     */
    function pauseStrategy(address strategy) external onlyRole(STRATEGIST_ROLE) {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();

        info.active = false;
        emit StrategyPaused(strategy);
    }

    /**
     * @notice Unpause a strategy
     * @param strategy Strategy address
     */
    function unpauseStrategy(address strategy) external onlyRole(STRATEGIST_ROLE) {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();

        info.active = true;
        emit StrategyUnpaused(strategy);
    }

    // ============ Core Functions ============

    /**
     * @notice Deposit funds across strategies
     * @param amount Total amount to deposit
     * @dev Called by LiquidityPool
     */
    function deposit(uint256 amount) external onlyPool nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        // Transfer from pool (pool should have approved this contract)
        asset.safeTransferFrom(msg.sender, address(this), amount);

        // Distribute across active strategies by weight
        uint256 deposited = _distributeDeposit(amount);

        emit Deposited(amount, deposited);
    }

    /**
     * @notice Withdraw funds from strategies
     * @param amount Amount to withdraw
     * @return received Actual amount received
     * @dev Called by LiquidityPool when liquidity is needed
     */
    function withdraw(uint256 amount) external onlyPool nonReentrant returns (uint256 received) {
        if (amount == 0) revert ZeroAmount();

        received = _withdrawFromStrategies(amount);

        // Check slippage
        uint256 minReceived = (amount * (10000 - withdrawSlippageTolerance)) / 10000;
        if (received < minReceived) {
            revert WithdrawalSlippageExceeded(amount, received);
        }

        // Transfer to pool
        asset.safeTransfer(liquidityPool, received);

        emit Withdrawn(amount, received);
    }

    /**
     * @notice Withdraw all funds from all strategies
     * @return received Total amount received
     */
    function withdrawAll() external onlyPool nonReentrant returns (uint256 received) {
        received = 0;

        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            StrategyInfo storage info = strategyInfo[strategy];

            if (info.deposited > 0) {
                uint256 strategyReceived = ITreasuryStrategy(strategy).withdrawAll();
                received += strategyReceived;
                info.deposited = 0;
                emit StrategyWithdraw(strategy, info.deposited, strategyReceived);
            }
        }

        if (received > 0) {
            asset.safeTransfer(liquidityPool, received);
        }

        emit Withdrawn(totalValue(), received);
    }

    /**
     * @notice Rebalance across strategies based on weights
     * @dev Moves funds between strategies to match target allocation
     */
    function rebalance() external onlyRole(STRATEGIST_ROLE) nonReentrant {
        if (block.timestamp < lastRebalance + rebalanceCooldown) {
            revert RebalanceCooldown();
        }

        uint256 total = totalValue();
        if (total == 0) return;

        // First, withdraw everything to this contract
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            StrategyInfo storage info = strategyInfo[strategy];

            if (info.deposited > 0) {
                ITreasuryStrategy(strategy).withdrawAll();
                info.deposited = 0;
            }
        }

        // Then redistribute based on weights
        uint256 balance = asset.balanceOf(address(this));
        _distributeDeposit(balance);

        lastRebalance = block.timestamp;
        emit Rebalanced(block.timestamp);
    }

    /**
     * @notice Harvest yield from a specific strategy
     * @param strategy Strategy address
     */
    function harvestYield(address strategy) external onlyRole(STRATEGIST_ROLE) nonReentrant {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();

        uint256 currentValue = ITreasuryStrategy(strategy).totalValue();
        if (currentValue > info.deposited) {
            uint256 yield = currentValue - info.deposited;
            info.lastHarvest = block.timestamp;
            emit YieldHarvested(strategy, yield);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get total value across all strategies
     * @return Total value in asset terms
     */
    function totalValue() public view returns (uint256) {
        uint256 total = asset.balanceOf(address(this)); // Undeposited balance

        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (strategyInfo[strategy].exists) {
                total += ITreasuryStrategy(strategy).totalValue();
            }
        }

        return total;
    }

    /**
     * @notice Get number of registered strategies
     */
    function strategyCount() external view returns (uint256) {
        return strategies.length;
    }

    /**
     * @notice Get all strategy addresses
     */
    function getAllStrategies() external view returns (address[] memory) {
        return strategies;
    }

    /**
     * @notice Get strategy allocation info
     * @param strategy Strategy address
     * @return currentValue Current value in strategy
     * @return targetAllocation Target allocation percentage (basis points)
     * @return currentAllocation Current allocation percentage (basis points)
     */
    function getStrategyAllocation(
        address strategy
    ) external view returns (
        uint256 currentValue,
        uint256 targetAllocation,
        uint256 currentAllocation
    ) {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();

        currentValue = ITreasuryStrategy(strategy).totalValue();
        targetAllocation = totalWeight > 0 ? (info.weight * 10000) / totalWeight : 0;

        uint256 total = totalValue();
        currentAllocation = total > 0 ? (currentValue * 10000) / total : 0;
    }

    /**
     * @notice Check if instant withdrawal is available for amount
     * @param amount Amount to check
     * @return available True if can withdraw instantly
     * @return maxInstant Maximum instant withdrawal amount
     */
    function canWithdrawInstant(
        uint256 amount
    ) external view returns (bool available, uint256 maxInstant) {
        maxInstant = asset.balanceOf(address(this)); // Start with undeposited

        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            if (strategyInfo[strategy].exists) {
                if (ITreasuryStrategy(strategy).supportsInstantWithdraw()) {
                    maxInstant += ITreasuryStrategy(strategy).maxInstantWithdraw();
                }
            }
        }

        available = maxInstant >= amount;
    }

    /**
     * @notice Get estimated APY across all strategies
     * @return Weighted average APY in basis points
     */
    function estimatedAPY() external view returns (uint256) {
        if (totalWeight == 0) return 0;

        uint256 weightedAPY = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            StrategyInfo storage info = strategyInfo[strategy];

            if (info.exists && info.active) {
                uint256 strategyAPY = ITreasuryStrategy(strategy).estimatedAPY();
                weightedAPY += (strategyAPY * info.weight);
            }
        }

        return weightedAPY / totalWeight;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update liquidity pool address
     * @param _liquidityPool New pool address
     */
    function setLiquidityPool(address _liquidityPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_liquidityPool == address(0)) revert ZeroAddress();

        address oldPool = liquidityPool;

        // Revoke old role
        _revokeRole(POOL_ROLE, oldPool);

        // Set new pool
        liquidityPool = _liquidityPool;
        _grantRole(POOL_ROLE, _liquidityPool);

        emit LiquidityPoolUpdated(oldPool, _liquidityPool);
    }

    /**
     * @notice Set rebalance cooldown
     * @param _cooldown New cooldown in seconds
     */
    function setRebalanceCooldown(uint256 _cooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rebalanceCooldown = _cooldown;
    }

    /**
     * @notice Set withdrawal slippage tolerance
     * @param _tolerance New tolerance in basis points
     */
    function setWithdrawSlippageTolerance(uint256 _tolerance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tolerance <= 1000, "Max 10% slippage");
        withdrawSlippageTolerance = _tolerance;
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
     * @notice Emergency withdraw from a specific strategy
     * @param strategy Strategy to withdraw from
     */
    function emergencyWithdrawFromStrategy(
        address strategy
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        StrategyInfo storage info = strategyInfo[strategy];
        if (!info.exists) revert StrategyNotFound();

        uint256 received = ITreasuryStrategy(strategy).withdrawAll();
        info.deposited = 0;
        info.active = false;

        // Keep funds in this contract (don't auto-send to pool)
        emit EmergencyWithdrawStrategy(strategy, received);
    }

    /**
     * @notice Rescue stuck tokens
     * @param token Token address
     * @param to Recipient
     * @param amount Amount to rescue
     */
    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // ============ Internal Functions ============

    /**
     * @notice Distribute deposit across strategies by weight
     * @param amount Total amount to distribute
     * @return strategiesDeposited Number of strategies that received deposits
     */
    function _distributeDeposit(uint256 amount) internal returns (uint256 strategiesDeposited) {
        if (totalWeight == 0) return 0;

        uint256 remaining = amount;
        strategiesDeposited = 0;

        for (uint256 i = 0; i < strategies.length && remaining > 0; i++) {
            address strategy = strategies[i];
            StrategyInfo storage info = strategyInfo[strategy];

            if (info.exists && info.active) {
                // Calculate allocation for this strategy
                uint256 allocation = (amount * info.weight) / totalWeight;

                if (allocation > 0 && allocation <= remaining) {
                    // Strategy pulls funds via safeTransferFrom (approved at addStrategy)
                    ITreasuryStrategy(strategy).deposit(allocation);

                    info.deposited += allocation;
                    remaining -= allocation;
                    strategiesDeposited++;

                    emit StrategyDeposit(strategy, allocation);
                }
            }
        }

        // If there's remaining dust, deposit to first active strategy
        if (remaining > 0 && strategies.length > 0) {
            for (uint256 i = 0; i < strategies.length; i++) {
                address strategy = strategies[i];
                StrategyInfo storage info = strategyInfo[strategy];

                if (info.exists && info.active) {
                    ITreasuryStrategy(strategy).deposit(remaining);
                    info.deposited += remaining;
                    emit StrategyDeposit(strategy, remaining);
                    break;
                }
            }
        }
    }

    /**
     * @notice Withdraw from strategies, prioritizing instant withdrawals
     * @param amount Amount to withdraw
     * @return received Actual amount received
     */
    function _withdrawFromStrategies(uint256 amount) internal returns (uint256 received) {
        received = 0;
        uint256 remaining = amount;

        // First, use any balance in this contract
        uint256 balance = asset.balanceOf(address(this));
        if (balance > 0) {
            uint256 fromBalance = balance > remaining ? remaining : balance;
            received += fromBalance;
            remaining -= fromBalance;
        }

        if (remaining == 0) return received;

        // Then withdraw from strategies (prioritize instant withdrawals)
        // First pass: strategies that support instant withdraw
        for (uint256 i = 0; i < strategies.length && remaining > 0; i++) {
            address strategy = strategies[i];
            StrategyInfo storage info = strategyInfo[strategy];

            if (info.exists && info.deposited > 0) {
                if (ITreasuryStrategy(strategy).supportsInstantWithdraw()) {
                    uint256 toWithdraw = remaining > info.deposited ? info.deposited : remaining;
                    uint256 strategyReceived = ITreasuryStrategy(strategy).withdraw(toWithdraw);

                    info.deposited -= toWithdraw;
                    received += strategyReceived;
                    remaining -= toWithdraw;

                    emit StrategyWithdraw(strategy, toWithdraw, strategyReceived);
                }
            }
        }

        // Second pass: other strategies
        for (uint256 i = 0; i < strategies.length && remaining > 0; i++) {
            address strategy = strategies[i];
            StrategyInfo storage info = strategyInfo[strategy];

            if (info.exists && info.deposited > 0) {
                if (!ITreasuryStrategy(strategy).supportsInstantWithdraw()) {
                    uint256 toWithdraw = remaining > info.deposited ? info.deposited : remaining;
                    uint256 strategyReceived = ITreasuryStrategy(strategy).withdraw(toWithdraw);

                    info.deposited -= toWithdraw;
                    received += strategyReceived;
                    remaining -= toWithdraw;

                    emit StrategyWithdraw(strategy, toWithdraw, strategyReceived);
                }
            }
        }
    }

    /**
     * @notice Remove strategy from array
     * @param strategy Strategy to remove
     */
    function _removeStrategyFromArray(address strategy) internal {
        uint256 length = strategies.length;
        for (uint256 i = 0; i < length; i++) {
            if (strategies[i] == strategy) {
                // Move last element to this position
                strategies[i] = strategies[length - 1];
                strategies.pop();
                break;
            }
        }
    }
}
