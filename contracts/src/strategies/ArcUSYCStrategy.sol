// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BaseCrossChainStrategy.sol";
import "../interfaces/ITokenMessenger.sol";

/**
 * @title ArcUSYCStrategy
 * @notice Cross-chain strategy that bridges USDC to Arc via CCTP for USYC yield
 * @dev Uses Circle's CCTP to bridge USDC to Arc chain for US Treasury yield
 *
 * Flow:
 * 1. TreasuryManager calls deposit() with USDC
 * 2. Strategy burns USDC via CCTP TokenMessenger.depositForBurn()
 * 3. Circle attestation service signs the burn message (~15-20 min)
 * 4. ArcUSYCAgent on Arc receives USDC and deposits to USYC
 * 5. Keeper reports remote value back to this contract
 * 6. On withdrawal, agent redeems USYC and bridges back via CCTP
 *
 * CCTP Addresses:
 * - Base TokenMessenger: 0x1682Ae6375C4E4A97e4B583BC394c861A46D8962
 * - Base Domain: 6
 * - Arc TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
 * - Arc Domain: 26
 * - USYC on Arc: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
 */
contract ArcUSYCStrategy is BaseCrossChainStrategy {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Arc chain ID (hypothetical, replace with actual)
    uint256 public constant ARC_CHAIN_ID = 26;

    /// @notice Base CCTP domain
    uint32 public constant BASE_DOMAIN = 6;

    /// @notice Arc CCTP domain
    uint32 public constant ARC_DOMAIN = 26;

    /// @notice CCTP TokenMessenger on Base
    address public constant TOKEN_MESSENGER_BASE = 0x1682Ae6375C4E4A97e4B583BC394c861A46D8962;

    // ============ State Variables ============

    /// @notice CCTP TokenMessenger
    ITokenMessenger public tokenMessenger;

    /// @notice Minimum bridge amount
    uint256 public minBridgeAmount = 10e6; // 10 USDC

    /// @notice Nonce to transfer ID mapping
    mapping(uint64 => bytes32) public nonceToTransferId;

    /// @notice Transfer ID to nonce mapping
    mapping(bytes32 => uint64) public transferIdToNonce;

    /// @notice Withdrawal requests waiting for keeper
    mapping(bytes32 => uint256) public withdrawalRequests;

    // ============ Events ============

    event CCTPBurnInitiated(
        bytes32 indexed transferId,
        uint64 indexed nonce,
        uint256 amount,
        bytes32 mintRecipient
    );

    event MinBridgeAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event WithdrawalRequested(bytes32 indexed transferId, uint256 amount);
    event TokenMessengerUpdated(address oldMessenger, address newMessenger);

    // ============ Errors ============

    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error CCTPBurnFailed();

    // ============ Constructor ============

    /**
     * @notice Initialize the Arc USYC Strategy
     * @param _usdc USDC address on Base
     * @param _treasuryManager TreasuryManager address
     * @param _remoteAgent ArcUSYCAgent address on Arc
     * @param _tokenMessenger CCTP TokenMessenger address (or use default)
     */
    constructor(
        address _usdc,
        address _treasuryManager,
        address _remoteAgent,
        address _tokenMessenger
    ) BaseCrossChainStrategy(
        _usdc,
        "Arc USYC T-Bill Strategy",
        _treasuryManager,
        ARC_CHAIN_ID,
        _remoteAgent,
        450 // 4.5% APY estimate
    ) {
        tokenMessenger = ITokenMessenger(
            _tokenMessenger != address(0) ? _tokenMessenger : TOKEN_MESSENGER_BASE
        );

        // Approve TokenMessenger to burn USDC
        _asset.approve(address(tokenMessenger), type(uint256).max);
    }

    // ============ Bridge Functions ============

    /**
     * @notice Initiate CCTP burn to Arc
     * @param amount Amount of USDC to bridge
     * @return transferId Unique transfer identifier
     */
    function _initiateBridgeDeposit(uint256 amount) internal override returns (bytes32 transferId) {
        if (amount < minBridgeAmount) {
            revert AmountBelowMinimum(amount, minBridgeAmount);
        }

        // Generate transfer ID
        transferId = _generateTransferId();

        // Convert agent address to bytes32 for CCTP
        bytes32 mintRecipient = bytes32(uint256(uint160(remoteAgent)));

        // Burn USDC via CCTP
        try tokenMessenger.depositForBurn(
            amount,
            ARC_DOMAIN,
            mintRecipient,
            address(_asset)
        ) returns (uint64 nonce) {
            // Store nonce mapping
            nonceToTransferId[nonce] = transferId;
            transferIdToNonce[transferId] = nonce;

            emit CCTPBurnInitiated(transferId, nonce, amount, mintRecipient);
        } catch {
            revert CCTPBurnFailed();
        }

        return transferId;
    }

    /**
     * @notice Initiate withdrawal request
     * @param amount Amount to withdraw from remote
     * @return transferId Withdrawal request identifier
     * @dev Emits event for keeper to process on Arc
     */
    function _initiateBridgeWithdrawal(uint256 amount) internal override returns (bytes32 transferId) {
        transferId = _generateTransferId();

        // Store withdrawal request
        withdrawalRequests[transferId] = amount;

        emit WithdrawalRequested(transferId, amount);

        return transferId;
    }

    // ============ CCTP Receive Functions ============

    /**
     * @notice Handle USDC received via CCTP (from withdrawal)
     * @param transferId The withdrawal transfer ID
     * @param messageNonce The CCTP message nonce
     * @dev Called by keeper after CCTP mints USDC on Base
     */
    function receiveCCTPFunds(bytes32 transferId, uint64 messageNonce) external onlyKeeper nonReentrant {
        uint256 amount = _asset.balanceOf(address(this));
        require(amount > 0, "No funds received");

        // Validate this is for a pending withdrawal
        PendingWithdrawal storage pending = _pendingWithdrawals[transferId];
        require(pending.state == TransferState.Pending, "Invalid state");

        // Update state
        pending.state = TransferState.Deployed;
        pendingWithdrawals -= pending.amount;

        // Update tracking
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
     * @notice Update TokenMessenger address
     * @param newMessenger New CCTP TokenMessenger address
     */
    function setTokenMessenger(address newMessenger) external onlyOwner {
        require(newMessenger != address(0), "Zero address");

        address oldMessenger = address(tokenMessenger);

        // Revoke old approval
        _asset.approve(oldMessenger, 0);

        // Set new messenger
        tokenMessenger = ITokenMessenger(newMessenger);

        // Approve new messenger
        _asset.approve(newMessenger, type(uint256).max);

        emit TokenMessengerUpdated(oldMessenger, newMessenger);
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
     * @notice Get transfer ID for a CCTP nonce
     */
    function getTransferIdByNonce(uint64 nonce) external view returns (bytes32) {
        return nonceToTransferId[nonce];
    }

    /**
     * @notice Get CCTP nonce for a transfer ID
     */
    function getNonceByTransferId(bytes32 transferId) external view returns (uint64) {
        return transferIdToNonce[transferId];
    }

    /**
     * @notice Get pending withdrawal request amount
     */
    function getWithdrawalRequest(bytes32 transferId) external view returns (uint256) {
        return withdrawalRequests[transferId];
    }

    /**
     * @notice Check if a transfer ID is a pending withdrawal
     */
    function isPendingWithdrawal(bytes32 transferId) external view returns (bool) {
        return withdrawalRequests[transferId] > 0;
    }

    /**
     * @notice Convert address to bytes32 (for CCTP recipient format)
     */
    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }
}
