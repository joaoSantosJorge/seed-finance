// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./ITreasuryStrategy.sol";

/**
 * @title ICrossChainStrategy
 * @notice Extended interface for cross-chain treasury strategies
 * @dev Cross-chain strategies differ from local strategies in key ways:
 *      - Deposits/withdrawals are async (require bridge confirmations)
 *      - Value reporting relies on keeper callbacks from remote chains
 *      - No instant withdrawals supported
 *
 * Example implementations:
 * - LiFiVaultStrategy: Bridge to Arbitrum via LI.FI → Aave V3
 * - ArcUSYCStrategy: Bridge to Arc via CCTP → USYC T-bills
 */
interface ICrossChainStrategy is ITreasuryStrategy {
    // ============ Enums ============

    /// @notice State of a cross-chain transfer
    enum TransferState {
        None,       // Transfer doesn't exist
        Pending,    // Transfer initiated, awaiting bridge confirmation
        Confirmed,  // Bridge confirmed, funds arrived on remote chain
        Deployed,   // Funds deployed into yield source
        Failed      // Transfer failed
    }

    // ============ Structs ============

    /// @notice Tracks a pending deposit transfer
    struct PendingDeposit {
        uint256 amount;         // USDC amount sent
        uint256 timestamp;      // When transfer was initiated
        TransferState state;    // Current state
        bytes32 bridgeId;       // Bridge-specific identifier (transferId, messageHash, etc.)
    }

    /// @notice Tracks a pending withdrawal transfer
    struct PendingWithdrawal {
        uint256 amount;         // USDC amount requested
        uint256 timestamp;      // When withdrawal was initiated
        TransferState state;    // Current state
        bytes32 bridgeId;       // Bridge-specific identifier
    }

    // ============ Events ============

    /// @notice Emitted when a cross-chain deposit is initiated
    event CrossChainDepositInitiated(
        bytes32 indexed transferId,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when a cross-chain deposit is confirmed
    event CrossChainDepositConfirmed(
        bytes32 indexed transferId,
        uint256 amount,
        uint256 sharesReceived
    );

    /// @notice Emitted when a cross-chain withdrawal is initiated
    event CrossChainWithdrawalInitiated(
        bytes32 indexed transferId,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when a cross-chain withdrawal completes (funds returned)
    event CrossChainWithdrawalCompleted(
        bytes32 indexed transferId,
        uint256 amountReceived
    );

    /// @notice Emitted when remote value is updated by keeper
    event RemoteValueUpdated(
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp
    );

    /// @notice Emitted when a keeper is authorized/deauthorized
    event KeeperUpdated(address indexed keeper, bool authorized);

    // ============ Errors ============

    error OnlyKeeper();
    error TransferNotFound(bytes32 transferId);
    error InvalidTransferState(bytes32 transferId, TransferState expected, TransferState actual);
    error ValueStale(uint256 lastUpdate, uint256 maxAge);
    error BridgeFailed(string reason);

    // ============ Cross-Chain View Functions ============

    /**
     * @notice Get total amount in pending deposits (in-flight to remote chain)
     * @return Total USDC amount awaiting bridge confirmation
     */
    function pendingDeposits() external view returns (uint256);

    /**
     * @notice Get total amount in pending withdrawals (in-flight back from remote)
     * @return Total USDC amount awaiting return
     */
    function pendingWithdrawals() external view returns (uint256);

    /**
     * @notice Get timestamp of last remote value update
     * @return Unix timestamp of last keeper callback
     */
    function lastValueUpdate() external view returns (uint256);

    /**
     * @notice Get the destination chain identifier
     * @return Chain ID of the remote chain (e.g., 42161 for Arbitrum)
     */
    function destinationChainId() external view returns (uint256);

    /**
     * @notice Get the remote agent contract address
     * @return Address of the agent contract on the destination chain
     */
    function remoteAgent() external view returns (address);

    /**
     * @notice Get the maximum allowed staleness for remote value
     * @return Max age in seconds before value is considered stale
     */
    function maxValueStaleness() external view returns (uint256);

    /**
     * @notice Check if the remote value is considered stale
     * @return True if value hasn't been updated within maxValueStaleness
     */
    function isValueStale() external view returns (bool);

    /**
     * @notice Get last reported value from remote chain (excluding pending)
     * @return The raw value last reported by the keeper
     */
    function lastReportedValue() external view returns (uint256);

    /**
     * @notice Get details of a pending deposit
     * @param transferId The bridge transfer identifier
     * @return The pending deposit details
     */
    function getPendingDeposit(bytes32 transferId) external view returns (PendingDeposit memory);

    /**
     * @notice Get details of a pending withdrawal
     * @param transferId The bridge transfer identifier
     * @return The pending withdrawal details
     */
    function getPendingWithdrawal(bytes32 transferId) external view returns (PendingWithdrawal memory);

    // ============ Cross-Chain Write Functions ============

    /**
     * @notice Update the remote value (keeper callback)
     * @param value Current value of assets on remote chain
     * @param proof Optional proof data (e.g., signed attestation)
     * @dev Called by authorized keepers to report remote chain state
     */
    function updateRemoteValue(uint256 value, bytes calldata proof) external;

    /**
     * @notice Confirm a deposit has arrived and been deployed on remote chain
     * @param transferId The bridge transfer identifier
     * @param sharesReceived Shares received on remote (if applicable)
     * @dev Called by keeper when funds are confirmed deployed
     */
    function confirmDeposit(bytes32 transferId, uint256 sharesReceived) external;

    /**
     * @notice Receive funds returning from a withdrawal
     * @param transferId The withdrawal transfer identifier
     * @param amount Actual USDC amount received
     * @dev Called when bridged funds arrive back on Base
     */
    function receiveWithdrawal(bytes32 transferId, uint256 amount) external;

    // ============ Admin Functions ============

    /**
     * @notice Set keeper authorization
     * @param keeper Address to authorize/deauthorize
     * @param authorized Whether to grant or revoke keeper role
     */
    function setKeeper(address keeper, bool authorized) external;

    /**
     * @notice Update max value staleness threshold
     * @param newMaxStaleness New max age in seconds
     */
    function setMaxValueStaleness(uint256 newMaxStaleness) external;

    /**
     * @notice Update the remote agent address
     * @param newAgent New agent contract address on remote chain
     */
    function setRemoteAgent(address newAgent) external;
}
