// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockLiFiBridgeExecutor
 * @notice Simulates LI.FI Diamond contract for cross-chain bridging
 * @dev Simulates the bridge initiation and completion for testing
 *
 * LI.FI Flow:
 * 1. User calls swapAndStartBridgeTokensViaBridge() on source
 * 2. LI.FI routes through optimal bridge
 * 3. Tokens arrive at destination via executor
 *
 * This mock simulates the full flow for local testing.
 */
contract MockLiFiBridgeExecutor {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    /// @notice LI.FI bridge data structure
    struct BridgeData {
        bytes32 transactionId;
        string bridge;
        string integrator;
        address referrer;
        address sendingAssetId;
        address receiver;
        uint256 minAmount;
        uint256 destinationChainId;
        bool hasSourceSwaps;
        bool hasDestinationCall;
    }

    /// @notice Pending bridge transfer
    struct PendingTransfer {
        address sender;
        address receiver;
        address token;
        uint256 amount;
        uint256 destinationChainId;
        uint256 timestamp;
        bool completed;
    }

    // ============ State Variables ============

    /// @notice Transfer counter
    uint256 public transferCounter;

    /// @notice Pending transfers by ID
    mapping(bytes32 => PendingTransfer) public pendingTransfers;

    /// @notice Authorized executors on destination
    mapping(address => bool) public authorizedExecutors;

    /// @notice Bridge fees (basis points)
    uint256 public bridgeFeeBps = 10; // 0.1%

    // ============ Events ============

    event LiFiTransferStarted(BridgeData bridgeData);

    event LiFiTransferCompleted(
        bytes32 indexed transactionId,
        address indexed receivingAssetId,
        address indexed receiver,
        uint256 amount,
        uint256 timestamp
    );

    event BridgeInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 amount,
        uint256 destinationChainId
    );

    event BridgeCompleted(
        bytes32 indexed transferId,
        address indexed receiver,
        uint256 amount
    );

    // ============ Constructor ============

    constructor() {
        authorizedExecutors[msg.sender] = true;
    }

    // ============ LI.FI Diamond Functions ============

    /**
     * @notice Start a bridge transfer (LI.FI Diamond interface)
     * @param _bridgeData Bridge configuration
     */
    function startBridgeTokensViaBridge(
        BridgeData calldata _bridgeData
    ) external payable {
        require(_bridgeData.minAmount > 0, "Amount must be > 0");

        // Transfer tokens from sender
        IERC20(_bridgeData.sendingAssetId).safeTransferFrom(
            msg.sender,
            address(this),
            _bridgeData.minAmount
        );

        // Calculate fee
        uint256 fee = (_bridgeData.minAmount * bridgeFeeBps) / 10000;
        uint256 amountAfterFee = _bridgeData.minAmount - fee;

        // Store pending transfer
        bytes32 transferId = _bridgeData.transactionId;
        if (transferId == bytes32(0)) {
            transferId = _generateTransferId(msg.sender, _bridgeData.minAmount);
        }

        pendingTransfers[transferId] = PendingTransfer({
            sender: msg.sender,
            receiver: _bridgeData.receiver,
            token: _bridgeData.sendingAssetId,
            amount: amountAfterFee,
            destinationChainId: _bridgeData.destinationChainId,
            timestamp: block.timestamp,
            completed: false
        });

        emit LiFiTransferStarted(_bridgeData);
        emit BridgeInitiated(
            transferId,
            msg.sender,
            _bridgeData.receiver,
            _bridgeData.sendingAssetId,
            amountAfterFee,
            _bridgeData.destinationChainId
        );
    }

    /**
     * @notice Simplified bridge function
     * @param token Token to bridge
     * @param amount Amount to bridge
     * @param receiver Receiver on destination
     * @param destinationChainId Target chain
     * @return transferId The transfer identifier
     */
    function bridge(
        address token,
        uint256 amount,
        address receiver,
        uint256 destinationChainId
    ) external returns (bytes32 transferId) {
        require(amount > 0, "Amount must be > 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * bridgeFeeBps) / 10000;
        uint256 amountAfterFee = amount - fee;

        transferId = _generateTransferId(msg.sender, amount);

        pendingTransfers[transferId] = PendingTransfer({
            sender: msg.sender,
            receiver: receiver,
            token: token,
            amount: amountAfterFee,
            destinationChainId: destinationChainId,
            timestamp: block.timestamp,
            completed: false
        });

        emit BridgeInitiated(
            transferId,
            msg.sender,
            receiver,
            token,
            amountAfterFee,
            destinationChainId
        );
    }

    /**
     * @notice Complete a bridge transfer (simulates destination execution)
     * @param transferId Transfer to complete
     * @param destinationToken Token on destination (may be different)
     * @dev In real LI.FI, this happens on the destination chain
     */
    function completeBridge(
        bytes32 transferId,
        address destinationToken
    ) external {
        require(authorizedExecutors[msg.sender], "Not authorized");

        PendingTransfer storage transfer = pendingTransfers[transferId];
        require(transfer.amount > 0, "Transfer not found");
        require(!transfer.completed, "Already completed");

        transfer.completed = true;

        // Transfer tokens to receiver
        IERC20(destinationToken).safeTransfer(transfer.receiver, transfer.amount);

        emit LiFiTransferCompleted(
            transferId,
            destinationToken,
            transfer.receiver,
            transfer.amount,
            block.timestamp
        );

        emit BridgeCompleted(transferId, transfer.receiver, transfer.amount);
    }

    /**
     * @notice Complete bridge and call receiver contract
     * @param transferId Transfer to complete
     * @param destinationToken Token on destination
     * @param callData Data to call on receiver
     */
    function completeBridgeAndCall(
        bytes32 transferId,
        address destinationToken,
        bytes calldata callData
    ) external {
        require(authorizedExecutors[msg.sender], "Not authorized");

        PendingTransfer storage transfer = pendingTransfers[transferId];
        require(transfer.amount > 0, "Transfer not found");
        require(!transfer.completed, "Already completed");

        transfer.completed = true;

        // Transfer tokens to receiver
        IERC20(destinationToken).safeTransfer(transfer.receiver, transfer.amount);

        // Call receiver if calldata provided
        if (callData.length > 0) {
            (bool success, ) = transfer.receiver.call(callData);
            require(success, "Receiver call failed");
        }

        emit LiFiTransferCompleted(
            transferId,
            destinationToken,
            transfer.receiver,
            transfer.amount,
            block.timestamp
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Set executor authorization
     */
    function setExecutor(address executor, bool authorized) external {
        authorizedExecutors[executor] = authorized;
    }

    /**
     * @notice Set bridge fee
     */
    function setBridgeFee(uint256 _feeBps) external {
        require(_feeBps <= 100, "Fee too high"); // Max 1%
        bridgeFeeBps = _feeBps;
    }

    /**
     * @notice Fund executor with tokens (for completing bridges)
     */
    function fundExecutor(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Withdraw stuck tokens
     */
    function withdraw(address token, uint256 amount, address to) external {
        IERC20(token).safeTransfer(to, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get pending transfer details
     */
    function getPendingTransfer(bytes32 transferId) external view returns (PendingTransfer memory) {
        return pendingTransfers[transferId];
    }

    /**
     * @notice Get token balance
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============ Internal Functions ============

    function _generateTransferId(address sender, uint256 amount) internal returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                sender,
                amount,
                block.chainid,
                transferCounter++,
                block.timestamp
            )
        );
    }
}
