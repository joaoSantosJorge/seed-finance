// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockCCTPMessageTransmitter
 * @notice Simulates Circle's CCTP MessageTransmitter for testing
 * @dev Provides both TokenMessenger (burn) and MessageTransmitter (mint) functionality
 *
 * CCTP Flow:
 * 1. Source: TokenMessenger.depositForBurn() - burns USDC, emits MessageSent
 * 2. Attestation: Circle signs the message (simulated instantly here)
 * 3. Destination: MessageTransmitter.receiveMessage() - mints USDC
 */
contract MockCCTPMessageTransmitter {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct PendingBurn {
        address sender;
        uint256 amount;
        uint32 destinationDomain;
        bytes32 mintRecipient;
        address destinationCaller;
        uint64 nonce;
        bool processed;
    }

    // ============ State Variables ============

    /// @notice USDC token on this chain
    IERC20 public usdc;

    /// @notice Domain ID for this chain
    uint32 public localDomain;

    /// @notice Nonce counter for messages
    uint64 public nextNonce;

    /// @notice Pending burns by message hash
    mapping(bytes32 => PendingBurn) public pendingBurns;

    /// @notice Used nonces (prevents replay)
    mapping(bytes32 => bool) public usedNonces;

    /// @notice Message hash to attestation (simulated)
    mapping(bytes32 => bytes) public attestations;

    // ============ Events ============

    /// @notice Emitted when USDC is burned for cross-chain transfer
    event DepositForBurn(
        uint64 indexed nonce,
        address indexed burnToken,
        uint256 amount,
        address indexed depositor,
        bytes32 mintRecipient,
        uint32 destinationDomain,
        bytes32 destinationTokenMessenger,
        bytes32 destinationCaller
    );

    /// @notice Emitted when a message is sent
    event MessageSent(bytes message);

    /// @notice Emitted when a message is received
    event MessageReceived(
        address indexed caller,
        uint32 sourceDomain,
        uint64 indexed nonce,
        bytes32 sender,
        bytes messageBody
    );

    // ============ Constructor ============

    constructor(address _usdc, uint32 _localDomain) {
        usdc = IERC20(_usdc);
        localDomain = _localDomain;
    }

    // ============ TokenMessenger Functions ============

    /**
     * @notice Deposit USDC for burn (initiate cross-chain transfer)
     * @param amount Amount of USDC to burn
     * @param destinationDomain CCTP domain of destination chain
     * @param mintRecipient Recipient address on destination (as bytes32)
     * @param burnToken USDC token address
     * @return nonce The message nonce
     */
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce) {
        require(burnToken == address(usdc), "Invalid burn token");
        require(amount > 0, "Amount must be > 0");

        // Transfer USDC from sender (simulates burn)
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        nonce = nextNonce++;

        // Generate message hash
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                localDomain,
                destinationDomain,
                nonce,
                msg.sender,
                mintRecipient,
                amount
            )
        );

        // Store pending burn
        pendingBurns[messageHash] = PendingBurn({
            sender: msg.sender,
            amount: amount,
            destinationDomain: destinationDomain,
            mintRecipient: mintRecipient,
            destinationCaller: address(0),
            nonce: nonce,
            processed: false
        });

        // Generate mock attestation immediately
        attestations[messageHash] = abi.encodePacked(
            "MOCK_ATTESTATION_",
            messageHash
        );

        // Encode message
        bytes memory message = abi.encodePacked(
            localDomain,
            destinationDomain,
            nonce,
            msg.sender,
            mintRecipient,
            amount
        );

        emit DepositForBurn(
            nonce,
            burnToken,
            amount,
            msg.sender,
            mintRecipient,
            destinationDomain,
            bytes32(0), // destinationTokenMessenger
            bytes32(0)  // destinationCaller
        );

        emit MessageSent(message);
    }

    /**
     * @notice Deposit for burn with caller restriction
     */
    function depositForBurnWithCaller(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller
    ) external returns (uint64 nonce) {
        require(burnToken == address(usdc), "Invalid burn token");
        require(amount > 0, "Amount must be > 0");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        nonce = nextNonce++;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                localDomain,
                destinationDomain,
                nonce,
                msg.sender,
                mintRecipient,
                amount,
                destinationCaller
            )
        );

        pendingBurns[messageHash] = PendingBurn({
            sender: msg.sender,
            amount: amount,
            destinationDomain: destinationDomain,
            mintRecipient: mintRecipient,
            destinationCaller: address(uint160(uint256(destinationCaller))),
            nonce: nonce,
            processed: false
        });

        attestations[messageHash] = abi.encodePacked("MOCK_ATTESTATION_", messageHash);

        emit DepositForBurn(
            nonce,
            burnToken,
            amount,
            msg.sender,
            mintRecipient,
            destinationDomain,
            bytes32(0),
            destinationCaller
        );
    }

    // ============ MessageTransmitter Functions ============

    /**
     * @notice Receive a cross-chain message (mints USDC)
     * @param message The message bytes
     * @param attestation The attestation signature
     * @return success Whether the message was processed
     */
    function receiveMessage(
        bytes calldata message,
        bytes calldata attestation
    ) external returns (bool success) {
        require(attestation.length > 0, "Missing attestation");

        // Prevent replay
        bytes32 messageHash = keccak256(message);
        require(!usedNonces[messageHash], "Nonce already used");
        usedNonces[messageHash] = true;

        // Decode only what we need
        (, uint32 destDomain, , , bytes32 mintRecipient, uint256 amount) =
            abi.decode(message, (uint32, uint32, uint64, address, bytes32, uint256));

        require(destDomain == localDomain, "Wrong destination domain");

        // Transfer USDC to recipient (simulating mint)
        address recipient = address(uint160(uint256(mintRecipient)));
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");
        usdc.safeTransfer(recipient, amount);

        return true;
    }

    // ============ Helper Functions ============

    /**
     * @notice Get attestation for a message (mock instant attestation)
     * @param messageHash Hash of the message
     * @return attestation The mock attestation bytes
     */
    function getAttestation(bytes32 messageHash) external view returns (bytes memory) {
        return attestations[messageHash];
    }

    /**
     * @notice Get pending burn details
     */
    function getPendingBurn(bytes32 messageHash) external view returns (PendingBurn memory) {
        return pendingBurns[messageHash];
    }

    /**
     * @notice Fund the mock with USDC (for simulating mints on destination)
     */
    function fundMock(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Set USDC address (for switching between test chains)
     */
    function setUSDC(address _usdc) external {
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Encode message for manual testing
     */
    function encodeMessage(
        uint32 sourceDomain,
        uint32 destDomain,
        uint64 nonce,
        address sender,
        bytes32 mintRecipient,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encode(sourceDomain, destDomain, nonce, sender, mintRecipient, amount);
    }

    /**
     * @notice Convert address to bytes32 (for mintRecipient)
     */
    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    /**
     * @notice Get current USDC balance
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
