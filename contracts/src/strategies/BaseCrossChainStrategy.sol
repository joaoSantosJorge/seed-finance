// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/ICrossChainStrategy.sol";

/**
 * @title BaseCrossChainStrategy
 * @notice Abstract base contract for cross-chain treasury strategies
 * @dev Provides common functionality for strategies that bridge assets to remote chains:
 *      - Async state machine for tracking transfers
 *      - Value tracking with staleness decay
 *      - Keeper authorization
 *      - Pending deposit/withdrawal accounting
 *
 * Implementation Guide:
 * 1. Inherit from BaseCrossChainStrategy
 * 2. Implement _initiateBridgeDeposit() - bridge-specific deposit logic
 * 3. Implement _initiateBridgeWithdrawal() - bridge-specific withdrawal logic
 * 4. Configure bridge addresses in constructor
 * 5. Authorize keepers via setKeeper()
 *
 * Value Calculation:
 * totalValue = lastReportedValue + pendingDeposits - pendingWithdrawals
 *
 * This provides an optimistic view of value while accounting for in-flight transfers.
 */
abstract contract BaseCrossChainStrategy is ICrossChainStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Default max staleness (1 hour)
    uint256 public constant DEFAULT_MAX_STALENESS = 1 hours;

    // ============ State Variables ============

    /// @notice The underlying asset (USDC)
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

    /// @notice Destination chain ID
    uint256 public override destinationChainId;

    /// @notice Remote agent contract address
    address public override remoteAgent;

    /// @notice Last value reported from remote chain
    uint256 public override lastReportedValue;

    /// @notice Timestamp of last value update
    uint256 public override lastValueUpdate;

    /// @notice Maximum staleness for value reporting
    uint256 public override maxValueStaleness;

    /// @notice Total pending deposits
    uint256 public override pendingDeposits;

    /// @notice Total pending withdrawals
    uint256 public override pendingWithdrawals;

    /// @notice Mapping of pending deposits by transfer ID
    mapping(bytes32 => PendingDeposit) internal _pendingDeposits;

    /// @notice Mapping of pending withdrawals by transfer ID
    mapping(bytes32 => PendingWithdrawal) internal _pendingWithdrawals;

    /// @notice Authorized keepers for value reporting
    mapping(address => bool) public keepers;

    /// @notice Transfer counter for generating unique IDs
    uint256 internal _transferCounter;

    // ============ Events ============

    event TreasuryManagerUpdated(address indexed oldManager, address indexed newManager);
    event EstimatedAPYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============ Errors ============

    error OnlyTreasuryManager();
    error StrategyNotActive();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance(uint256 requested, uint256 available);

    // ============ Modifiers ============

    modifier onlyManager() {
        if (msg.sender != treasuryManager) revert OnlyTreasuryManager();
        _;
    }

    modifier onlyKeeper() {
        if (!keepers[msg.sender]) revert OnlyKeeper();
        _;
    }

    modifier whenActive() {
        if (!isActive) revert StrategyNotActive();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize base cross-chain strategy
     * @param asset_ Underlying asset address (USDC)
     * @param name_ Strategy name
     * @param treasuryManager_ TreasuryManager address
     * @param destinationChainId_ Target chain ID
     * @param remoteAgent_ Agent contract on remote chain
     * @param initialAPY Initial APY estimate in basis points
     */
    constructor(
        address asset_,
        string memory name_,
        address treasuryManager_,
        uint256 destinationChainId_,
        address remoteAgent_,
        uint256 initialAPY
    ) Ownable(msg.sender) {
        if (asset_ == address(0)) revert ZeroAddress();
        if (treasuryManager_ == address(0)) revert ZeroAddress();
        if (remoteAgent_ == address(0)) revert ZeroAddress();

        _asset = IERC20(asset_);
        _name = name_;
        treasuryManager = treasuryManager_;
        destinationChainId = destinationChainId_;
        remoteAgent = remoteAgent_;
        estimatedAPY = initialAPY;
        maxValueStaleness = DEFAULT_MAX_STALENESS;
        isActive = true;

        // Owner is automatically a keeper
        keepers[msg.sender] = true;
    }

    // ============ ITreasuryStrategy Implementation ============

    /**
     * @notice Deposit assets into the strategy (initiates cross-chain transfer)
     * @param amount Amount to deposit
     * @return shares Always returns 0 for cross-chain (shares tracked on remote)
     */
    function deposit(
        uint256 amount
    ) external override onlyManager whenActive nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        // Transfer from TreasuryManager
        _asset.safeTransferFrom(msg.sender, address(this), amount);

        // Initiate bridge transfer
        bytes32 transferId = _initiateBridgeDeposit(amount);

        // Track pending deposit
        _pendingDeposits[transferId] = PendingDeposit({
            amount: amount,
            timestamp: block.timestamp,
            state: TransferState.Pending,
            bridgeId: transferId
        });
        pendingDeposits += amount;

        totalDeposited += amount;

        emit CrossChainDepositInitiated(transferId, amount, block.timestamp);
        emit Deposited(msg.sender, amount, 0);

        return 0; // Shares tracked on remote chain
    }

    /**
     * @notice Withdraw assets (initiates cross-chain withdrawal request)
     * @param amount Amount to withdraw
     * @return received Always returns 0 initially (async withdrawal)
     */
    function withdraw(
        uint256 amount
    ) external override onlyManager nonReentrant returns (uint256 received) {
        if (amount == 0) revert ZeroAmount();

        // Check we have sufficient value (reported + pending deposits - pending withdrawals)
        uint256 available = _totalValue();
        if (amount > available) {
            revert InsufficientBalance(amount, available);
        }

        // Initiate withdrawal request
        bytes32 transferId = _initiateBridgeWithdrawal(amount);

        // Track pending withdrawal
        _pendingWithdrawals[transferId] = PendingWithdrawal({
            amount: amount,
            timestamp: block.timestamp,
            state: TransferState.Pending,
            bridgeId: transferId
        });
        pendingWithdrawals += amount;

        emit CrossChainWithdrawalInitiated(transferId, amount, block.timestamp);
        emit Withdrawn(msg.sender, amount, 0);

        return 0; // Funds return asynchronously
    }

    /**
     * @notice Withdraw all assets
     * @return received Returns 0 (async)
     */
    function withdrawAll() external override onlyManager nonReentrant returns (uint256 received) {
        uint256 totalVal = _totalValue();
        if (totalVal == 0) return 0;

        bytes32 transferId = _initiateBridgeWithdrawal(totalVal);

        _pendingWithdrawals[transferId] = PendingWithdrawal({
            amount: totalVal,
            timestamp: block.timestamp,
            state: TransferState.Pending,
            bridgeId: transferId
        });
        pendingWithdrawals += totalVal;

        emit CrossChainWithdrawalInitiated(transferId, totalVal, block.timestamp);
        emit Withdrawn(msg.sender, totalVal, 0);

        return 0;
    }

    /**
     * @notice Get total value of assets in strategy
     * @return Optimistic total value
     */
    function totalValue() external view override returns (uint256) {
        return _totalValue();
    }

    /**
     * @notice Internal total value calculation
     * @dev totalValue = lastReportedValue + pendingDeposits - pendingWithdrawals
     */
    function _totalValue() internal view returns (uint256) {
        uint256 value = lastReportedValue + pendingDeposits;
        if (pendingWithdrawals >= value) {
            return 0;
        }
        return value - pendingWithdrawals;
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
     * @notice Cross-chain strategies do not support instant withdrawals
     */
    function supportsInstantWithdraw() external pure override returns (bool) {
        return false;
    }

    /**
     * @notice No instant withdrawals available
     */
    function maxInstantWithdraw() external pure override returns (uint256) {
        return 0;
    }

    // ============ ICrossChainStrategy Implementation ============

    /**
     * @notice Check if value is stale
     */
    function isValueStale() external view override returns (bool) {
        return block.timestamp - lastValueUpdate > maxValueStaleness;
    }

    /**
     * @notice Get pending deposit details
     */
    function getPendingDeposit(bytes32 transferId) external view override returns (PendingDeposit memory) {
        return _pendingDeposits[transferId];
    }

    /**
     * @notice Get pending withdrawal details
     */
    function getPendingWithdrawal(bytes32 transferId) external view override returns (PendingWithdrawal memory) {
        return _pendingWithdrawals[transferId];
    }

    /**
     * @notice Update remote value (keeper callback)
     * @param value Current value on remote chain
     * @param proof Optional proof data (unused in base implementation)
     */
    function updateRemoteValue(uint256 value, bytes calldata proof) external override onlyKeeper {
        (proof); // Unused in base, can be used by derived contracts

        uint256 oldValue = lastReportedValue;
        lastReportedValue = value;
        lastValueUpdate = block.timestamp;

        emit RemoteValueUpdated(oldValue, value, block.timestamp);
    }

    /**
     * @notice Confirm deposit arrived on remote chain
     * @param transferId Bridge transfer identifier
     * @param sharesReceived Shares received on remote
     */
    function confirmDeposit(bytes32 transferId, uint256 sharesReceived) external override onlyKeeper {
        PendingDeposit storage pending = _pendingDeposits[transferId];

        if (pending.state == TransferState.None) {
            revert TransferNotFound(transferId);
        }
        if (pending.state != TransferState.Pending) {
            revert InvalidTransferState(transferId, TransferState.Pending, pending.state);
        }

        // Update state
        pending.state = TransferState.Deployed;

        // Move from pending to deployed
        pendingDeposits -= pending.amount;

        // Update remote value to reflect new deposit
        lastReportedValue += pending.amount;
        lastValueUpdate = block.timestamp;

        emit CrossChainDepositConfirmed(transferId, pending.amount, sharesReceived);
    }

    /**
     * @notice Receive withdrawal funds returning from remote
     * @param transferId Withdrawal transfer identifier
     * @param amount USDC amount received
     */
    function receiveWithdrawal(bytes32 transferId, uint256 amount) external override onlyKeeper nonReentrant {
        PendingWithdrawal storage pending = _pendingWithdrawals[transferId];

        if (pending.state == TransferState.None) {
            revert TransferNotFound(transferId);
        }
        if (pending.state != TransferState.Pending) {
            revert InvalidTransferState(transferId, TransferState.Pending, pending.state);
        }

        // Update state
        pending.state = TransferState.Deployed; // Reusing as "completed"

        // Remove from pending
        pendingWithdrawals -= pending.amount;

        // Update tracking
        if (amount >= totalDeposited) {
            totalDeposited = 0;
        } else {
            totalDeposited -= amount;
        }

        // Reduce reported value
        if (pending.amount <= lastReportedValue) {
            lastReportedValue -= pending.amount;
        } else {
            lastReportedValue = 0;
        }

        // Transfer to TreasuryManager
        _asset.safeTransfer(treasuryManager, amount);

        emit CrossChainWithdrawalCompleted(transferId, amount);
    }

    // ============ Abstract Functions ============

    /**
     * @notice Initiate a bridge deposit to remote chain
     * @param amount Amount to bridge
     * @return transferId Unique identifier for this transfer
     * @dev Must be implemented by derived contracts with bridge-specific logic
     */
    function _initiateBridgeDeposit(uint256 amount) internal virtual returns (bytes32 transferId);

    /**
     * @notice Initiate a bridge withdrawal from remote chain
     * @param amount Amount to withdraw
     * @return transferId Unique identifier for this transfer
     * @dev Must be implemented by derived contracts with bridge-specific logic
     */
    function _initiateBridgeWithdrawal(uint256 amount) internal virtual returns (bytes32 transferId);

    // ============ Admin Functions ============

    /**
     * @notice Set keeper authorization
     */
    function setKeeper(address keeper, bool authorized) external override onlyOwner {
        if (keeper == address(0)) revert ZeroAddress();
        keepers[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    /**
     * @notice Update max value staleness
     */
    function setMaxValueStaleness(uint256 newMaxStaleness) external override onlyOwner {
        maxValueStaleness = newMaxStaleness;
    }

    /**
     * @notice Update remote agent address
     */
    function setRemoteAgent(address newAgent) external override onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        remoteAgent = newAgent;
    }

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
     * @notice Generate unique transfer ID
     */
    function _generateTransferId() internal returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                _transferCounter++,
                block.timestamp
            )
        );
    }

    /**
     * @notice Emergency withdraw to owner
     * @dev Withdraws any USDC stuck in the contract (not on remote chain)
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = _asset.balanceOf(address(this));
        if (balance > 0) {
            _asset.safeTransfer(owner(), balance);
        }
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
