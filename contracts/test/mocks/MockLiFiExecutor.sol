// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockLiFiExecutor
 * @notice Simulates LI.FI executor for testnet testing
 * @dev Used to test LiFiReceiver without real LI.FI bridges
 *
 * In production, LI.FI executors:
 * 1. Receive cross-chain messages
 * 2. Execute swaps on destination chain
 * 3. Call the receiver contract with the resulting tokens
 *
 * This mock simulates step 3 for testing purposes.
 */
contract MockLiFiExecutor {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice USDC token on this chain
    IERC20 public immutable usdc;

    /// @notice Simulated transfer counter
    uint256 public transferCounter;

    /// @notice Track simulated transfers
    mapping(bytes32 => Transfer) public transfers;

    struct Transfer {
        address user;
        uint256 amount;
        address receiver;
        bool executed;
        uint256 timestamp;
    }

    // ============ Events ============

    event TransferSimulated(
        bytes32 indexed transferId,
        address indexed user,
        uint256 amount,
        address receiver
    );

    event TransferExecuted(
        bytes32 indexed transferId,
        address indexed user,
        uint256 amount,
        bool success
    );

    // ============ Constructor ============

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // ============ Mock Functions ============

    /**
     * @notice Simulate a LI.FI bridge transfer
     * @param user The user who initiated the transfer
     * @param amount Amount of USDC to deliver
     * @param receiver LiFiReceiver contract address
     * @return transferId The simulated transfer ID
     * @dev This simulates what happens when LI.FI bridges tokens
     */
    function simulateBridgeTransfer(
        address user,
        uint256 amount,
        address receiver
    ) external returns (bytes32 transferId) {
        // Generate transfer ID (in real LI.FI, this comes from the source chain)
        transferId = keccak256(
            abi.encodePacked(
                block.chainid,
                transferCounter++,
                user,
                amount,
                block.timestamp
            )
        );

        transfers[transferId] = Transfer({
            user: user,
            amount: amount,
            receiver: receiver,
            executed: false,
            timestamp: block.timestamp
        });

        emit TransferSimulated(transferId, user, amount, receiver);
    }

    /**
     * @notice Execute a simulated transfer (call LiFiReceiver)
     * @param transferId The transfer to execute
     * @dev This simulates LI.FI executor calling the receiver contract
     */
    function executeTransfer(bytes32 transferId) external {
        Transfer storage transfer = transfers[transferId];
        require(transfer.amount > 0, "Transfer not found");
        require(!transfer.executed, "Already executed");

        transfer.executed = true;

        // Transfer USDC to receiver first (simulating LI.FI behavior)
        usdc.safeTransfer(transfer.receiver, transfer.amount);

        // Call receiver contract
        (bool success, ) = transfer.receiver.call(
            abi.encodeWithSignature(
                "receiveAndDeposit(address,uint256,bytes32)",
                transfer.user,
                transfer.amount,
                transferId
            )
        );

        emit TransferExecuted(transferId, transfer.user, transfer.amount, success);
    }

    /**
     * @notice Execute transfer in one step (for simpler testing)
     * @param user The user who will receive shares
     * @param amount Amount of USDC
     * @param receiver LiFiReceiver contract address
     * @return transferId The generated transfer ID
     */
    function executeDirectTransfer(
        address user,
        uint256 amount,
        address receiver
    ) external returns (bytes32 transferId) {
        transferId = keccak256(
            abi.encodePacked(
                block.chainid,
                transferCounter++,
                user,
                amount,
                block.timestamp
            )
        );

        // Transfer USDC to receiver
        usdc.safeTransfer(receiver, amount);

        // Call receiver contract
        (bool success, ) = receiver.call(
            abi.encodeWithSignature(
                "receiveAndDeposit(address,uint256,bytes32)",
                user,
                amount,
                transferId
            )
        );

        require(success, "Receiver call failed");

        emit TransferExecuted(transferId, user, amount, success);
    }

    /**
     * @notice Execute transfer with calldata variant
     * @param user The user who will receive shares
     * @param amount Amount of USDC
     * @param receiver LiFiReceiver contract address
     * @param data Additional calldata
     * @return transferId The generated transfer ID
     */
    function executeDirectTransferWithData(
        address user,
        uint256 amount,
        address receiver,
        bytes calldata data
    ) external returns (bytes32 transferId) {
        transferId = keccak256(
            abi.encodePacked(
                block.chainid,
                transferCounter++,
                user,
                amount,
                block.timestamp
            )
        );

        // Transfer USDC to receiver
        usdc.safeTransfer(receiver, amount);

        // Call receiver contract with data
        (bool success, ) = receiver.call(
            abi.encodeWithSignature(
                "receiveAndDeposit(address,uint256,bytes32,bytes)",
                user,
                amount,
                transferId,
                data
            )
        );

        require(success, "Receiver call failed");

        emit TransferExecuted(transferId, user, amount, success);
    }

    // ============ Helper Functions ============

    /**
     * @notice Fund the executor with USDC for testing
     * @param amount Amount to fund
     * @dev Caller must approve this contract first
     */
    function fundExecutor(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Get transfer details
     * @param transferId Transfer ID to query
     */
    function getTransfer(bytes32 transferId) external view returns (Transfer memory) {
        return transfers[transferId];
    }

    /**
     * @notice Get executor USDC balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
