// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ITreasuryStrategy
 * @notice Interface for treasury yield strategies
 * @dev All treasury strategies must implement this interface to be compatible
 *      with the TreasuryManager. This enables pluggable yield sources.
 *
 * Example strategies:
 * - USYCStrategy: Hashnote US Treasury yield
 * - AaveStrategy: Aave lending pool
 * - CompoundStrategy: Compound lending
 * - MorphoStrategy: Morpho optimized lending
 */
interface ITreasuryStrategy {
    // ============ Events ============

    /// @notice Emitted when assets are deposited into the strategy
    event Deposited(address indexed caller, uint256 amount, uint256 shares);

    /// @notice Emitted when assets are withdrawn from the strategy
    event Withdrawn(address indexed caller, uint256 amount, uint256 received);

    /// @notice Emitted when the strategy is paused/unpaused
    event StrategyStatusChanged(bool active);

    // ============ Core Functions ============

    /**
     * @notice Deposit assets into the strategy
     * @param amount Amount of underlying asset to deposit
     * @return shares Amount of strategy shares received (if applicable)
     */
    function deposit(uint256 amount) external returns (uint256 shares);

    /**
     * @notice Withdraw a specific amount from the strategy
     * @param amount Amount of underlying asset to withdraw
     * @return received Actual amount received (may differ due to fees/slippage)
     */
    function withdraw(uint256 amount) external returns (uint256 received);

    /**
     * @notice Withdraw all assets from the strategy
     * @return received Total amount received
     */
    function withdrawAll() external returns (uint256 received);

    // ============ View Functions ============

    /**
     * @notice Get the total value of assets in this strategy
     * @return Total value in underlying asset terms
     */
    function totalValue() external view returns (uint256);

    /**
     * @notice Get the underlying asset address (e.g., USDC)
     * @return Address of the underlying asset
     */
    function asset() external view returns (address);

    /**
     * @notice Check if the strategy is currently active
     * @return True if active, false if paused
     */
    function isActive() external view returns (bool);

    /**
     * @notice Get the current APY estimate for this strategy
     * @return APY in basis points (e.g., 500 = 5%)
     */
    function estimatedAPY() external view returns (uint256);

    /**
     * @notice Get the strategy name for identification
     * @return Strategy name string
     */
    function name() external view returns (string memory);

    /**
     * @notice Check if instant withdrawals are supported
     * @dev Some strategies may have withdrawal delays
     * @return True if instant withdrawals are supported
     */
    function supportsInstantWithdraw() external view returns (bool);

    /**
     * @notice Get maximum amount that can be withdrawn instantly
     * @return Maximum instant withdrawal amount
     */
    function maxInstantWithdraw() external view returns (uint256);
}
