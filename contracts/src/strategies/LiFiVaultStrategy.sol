// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BaseCrossChainStrategy.sol";
import "../interfaces/ILiFiDiamond.sol";

/**
 * @title LiFiVaultStrategy
 * @notice Cross-chain strategy that bridges USDC to Arbitrum via LI.FI for Aave V3 yield
 * @dev Deposits USDC into Aave V3 on Arbitrum through LI.FI bridge
 *
 * Flow:
 * 1. TreasuryManager calls deposit() with USDC
 * 2. Strategy bridges USDC to Arbitrum via LI.FI Diamond
 * 3. LiFiVaultAgent on Arbitrum receives funds and deposits to Aave V3
 * 4. Keeper reports remote value back to this contract
 * 5. On withdrawal, agent withdraws from Aave and bridges back
 *
 * Addresses:
 * - LI.FI Diamond (Base): 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE
 * - Arbitrum Chain ID: 42161
 * - Aave V3 Pool (Arbitrum): 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 */
contract LiFiVaultStrategy is BaseCrossChainStrategy {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Arbitrum One chain ID
    uint256 public constant ARBITRUM_CHAIN_ID = 42161;

    /// @notice LI.FI Diamond on Base Mainnet
    address public constant LIFI_DIAMOND_BASE = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    /// @notice Default bridge to use
    string public constant DEFAULT_BRIDGE = "stargate";

    /// @notice Integrator identifier
    string public constant INTEGRATOR = "seed-finance";

    // ============ State Variables ============

    /// @notice LI.FI Diamond contract
    ILiFiDiamond public lifiDiamond;

    /// @notice Bridge to use (configurable)
    string public bridge;

    /// @notice Minimum bridge amount (to cover fees)
    uint256 public minBridgeAmount = 10e6; // 10 USDC

    /// @notice Mapping of withdrawal requests waiting for keeper
    mapping(bytes32 => uint256) public withdrawalRequests;

    // ============ Events ============

    event BridgeUpdated(string oldBridge, string newBridge);
    event MinBridgeAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event WithdrawalRequested(bytes32 indexed transferId, uint256 amount);
    event LiFiDiamondUpdated(address oldDiamond, address newDiamond);

    // ============ Errors ============

    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error BridgeCallFailed();

    // ============ Constructor ============

    /**
     * @notice Initialize the LiFi Vault Strategy
     * @param _usdc USDC address on Base
     * @param _treasuryManager TreasuryManager address
     * @param _remoteAgent LiFiVaultAgent address on Arbitrum
     * @param _lifiDiamond LI.FI Diamond address (or use default)
     */
    constructor(
        address _usdc,
        address _treasuryManager,
        address _remoteAgent,
        address _lifiDiamond
    ) BaseCrossChainStrategy(
        _usdc,
        "LiFi Aave V3 Strategy",
        _treasuryManager,
        ARBITRUM_CHAIN_ID,
        _remoteAgent,
        400 // 4% APY estimate
    ) {
        lifiDiamond = ILiFiDiamond(_lifiDiamond != address(0) ? _lifiDiamond : LIFI_DIAMOND_BASE);
        bridge = DEFAULT_BRIDGE;

        // Approve LI.FI to spend USDC
        _asset.approve(address(lifiDiamond), type(uint256).max);
    }

    // ============ Bridge Functions ============

    /**
     * @notice Initiate bridge deposit to Arbitrum
     * @param amount Amount of USDC to bridge
     * @return transferId Unique transfer identifier
     */
    function _initiateBridgeDeposit(uint256 amount) internal override returns (bytes32 transferId) {
        if (amount < minBridgeAmount) {
            revert AmountBelowMinimum(amount, minBridgeAmount);
        }

        // Generate transfer ID
        transferId = _generateTransferId();

        // Build bridge data
        ILiFiDiamond.BridgeData memory bridgeData = ILiFiDiamond.BridgeData({
            transactionId: transferId,
            bridge: bridge,
            integrator: INTEGRATOR,
            referrer: address(0),
            sendingAssetId: address(_asset),
            receiver: remoteAgent,
            minAmount: amount,
            destinationChainId: ARBITRUM_CHAIN_ID,
            hasSourceSwaps: false,
            hasDestinationCall: false
        });

        // Execute bridge
        try lifiDiamond.startBridgeTokensViaBridge(bridgeData) {
            // Success
        } catch {
            revert BridgeCallFailed();
        }

        return transferId;
    }

    /**
     * @notice Initiate withdrawal request
     * @param amount Amount to withdraw from remote
     * @return transferId Withdrawal request identifier
     * @dev Emits event for keeper to pick up and process on Arbitrum
     */
    function _initiateBridgeWithdrawal(uint256 amount) internal override returns (bytes32 transferId) {
        transferId = _generateTransferId();

        // Store withdrawal request for keeper to process
        withdrawalRequests[transferId] = amount;

        emit WithdrawalRequested(transferId, amount);

        return transferId;
    }

    // ============ Keeper Functions ============

    /**
     * @notice Receive bridged funds returning from withdrawal
     * @param transferId The withdrawal transfer ID
     * @dev Called by keeper after funds arrive back on Base
     */
    function receiveBridgedFunds(bytes32 transferId) external onlyKeeper nonReentrant {
        uint256 amount = _asset.balanceOf(address(this));
        require(amount > 0, "No funds received");

        // Use parent's receiveWithdrawal logic
        PendingWithdrawal storage pending = _pendingWithdrawals[transferId];
        require(pending.state == TransferState.Pending, "Invalid state");

        pending.state = TransferState.Deployed;
        pendingWithdrawals -= pending.amount;

        if (pending.amount >= totalDeposited) {
            totalDeposited = 0;
        } else {
            totalDeposited -= pending.amount;
        }

        if (pending.amount <= lastReportedValue) {
            lastReportedValue -= pending.amount;
        } else {
            lastReportedValue = 0;
        }

        // Clear withdrawal request
        delete withdrawalRequests[transferId];

        // Transfer to TreasuryManager
        _asset.safeTransfer(treasuryManager, amount);

        emit CrossChainWithdrawalCompleted(transferId, amount);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update LI.FI Diamond address
     * @param newDiamond New Diamond contract address
     */
    function setLiFiDiamond(address newDiamond) external onlyOwner {
        require(newDiamond != address(0), "Zero address");

        address oldDiamond = address(lifiDiamond);

        // Revoke old approval
        _asset.approve(oldDiamond, 0);

        // Set new diamond
        lifiDiamond = ILiFiDiamond(newDiamond);

        // Approve new diamond
        _asset.approve(newDiamond, type(uint256).max);

        emit LiFiDiamondUpdated(oldDiamond, newDiamond);
    }

    /**
     * @notice Update bridge to use
     * @param newBridge Bridge name (e.g., "stargate", "across", "hop")
     */
    function setBridge(string calldata newBridge) external onlyOwner {
        string memory oldBridge = bridge;
        bridge = newBridge;
        emit BridgeUpdated(oldBridge, newBridge);
    }

    /**
     * @notice Update minimum bridge amount
     * @param newMinAmount New minimum in USDC (6 decimals)
     */
    function setMinBridgeAmount(uint256 newMinAmount) external onlyOwner {
        uint256 oldAmount = minBridgeAmount;
        minBridgeAmount = newMinAmount;
        emit MinBridgeAmountUpdated(oldAmount, newMinAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get pending withdrawal request amount
     * @param transferId Transfer ID
     * @return amount Requested withdrawal amount
     */
    function getWithdrawalRequest(bytes32 transferId) external view returns (uint256 amount) {
        return withdrawalRequests[transferId];
    }

    /**
     * @notice Check if a transfer ID is a pending withdrawal
     */
    function isPendingWithdrawal(bytes32 transferId) external view returns (bool) {
        return withdrawalRequests[transferId] > 0;
    }
}
