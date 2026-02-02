// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

/**
 * @title CCTPReceiver
 * @notice Receives USDC from Circle CCTP cross-chain transfers and auto-deposits to LiquidityPool
 * @dev This contract is the destination for CCTP cross-chain USDC transfers.
 *      When USDC arrives via CCTP, it automatically deposits into the ERC-4626
 *      LiquidityPool and transfers the resulting SEED shares to the beneficiary.
 *
 * CCTP Flow:
 * 1. User burns USDC on source chain via TokenMessenger.depositForBurn()
 * 2. Circle's attestation service creates attestation (~13-19 minutes)
 * 3. User/relayer calls MessageTransmitter.receiveMessage() with attestation
 * 4. USDC is minted to this contract on Base
 * 5. This contract auto-deposits to LiquidityPool
 * 6. User receives SEED shares
 *
 * Fallback Mechanism:
 * - If auto-deposit fails, USDC is held as pending deposit
 * - User can claim their pending deposit manually
 * - Admin can also process pending deposits
 */
contract CCTPReceiver is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice USDC token address on Base
    IERC20 public immutable usdc;

    /// @notice LiquidityPool (ERC-4626 vault) address
    IERC4626 public immutable liquidityPool;

    /// @notice CCTP MessageTransmitter contract on Base
    address public messageTransmitter;

    /// @notice Minimum deposit amount (prevents dust attacks)
    uint256 public minDepositAmount;

    /// @notice Pending deposits for users (fallback when auto-deposit fails)
    mapping(address => uint256) public pendingDeposits;

    /// @notice Total USDC received through this contract
    uint256 public totalReceived;

    /// @notice Total deposits made to pool
    uint256 public totalDeposited;

    /// @notice Number of successful deposits
    uint256 public depositCount;

    /// @notice Total pending deposits
    uint256 public totalPending;

    /// @notice Nonces that have been processed (prevents replay)
    mapping(bytes32 => bool) public processedNonces;

    // ============ CCTP Domain IDs ============

    /// @notice CCTP domain IDs for supported chains
    uint32 public constant DOMAIN_ETHEREUM = 0;
    uint32 public constant DOMAIN_AVALANCHE = 1;
    uint32 public constant DOMAIN_OP_MAINNET = 2;
    uint32 public constant DOMAIN_ARBITRUM = 3;
    uint32 public constant DOMAIN_SOLANA = 5;
    uint32 public constant DOMAIN_BASE = 6;
    uint32 public constant DOMAIN_POLYGON = 7;

    // ============ Events ============

    event DepositReceived(
        address indexed beneficiary,
        uint256 usdcAmount,
        uint256 sharesReceived,
        uint32 indexed sourceDomain,
        bytes32 indexed nonce
    );

    event DirectDeposit(
        address indexed user,
        uint256 usdcAmount,
        uint256 sharesReceived
    );

    event PendingDepositCreated(
        address indexed beneficiary,
        uint256 amount,
        string reason
    );

    event PendingDepositClaimed(
        address indexed beneficiary,
        uint256 amount,
        uint256 sharesReceived
    );

    event PendingDepositWithdrawn(
        address indexed beneficiary,
        uint256 amount
    );

    event MessageTransmitterUpdated(address indexed oldTransmitter, address indexed newTransmitter);
    event MinDepositUpdated(uint256 oldAmount, uint256 newAmount);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ============ Errors ============

    error UnauthorizedCaller(address caller);
    error InvalidBeneficiary();
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error ZeroAmount();
    error ZeroAddress();
    error DepositFailed();
    error TransferFailed();
    error NoPendingDeposit();
    error NonceAlreadyProcessed(bytes32 nonce);
    error MessageTransmitterNotSet();

    // ============ Constructor ============

    /**
     * @notice Initialize the CCTPReceiver
     * @param _usdc USDC token address on Base
     * @param _liquidityPool LiquidityPool (ERC-4626 vault) address
     * @param _messageTransmitter CCTP MessageTransmitter address on Base
     * @param _minDepositAmount Minimum deposit amount in USDC
     */
    constructor(
        address _usdc,
        address _liquidityPool,
        address _messageTransmitter,
        uint256 _minDepositAmount
    ) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_liquidityPool == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        liquidityPool = IERC4626(_liquidityPool);
        messageTransmitter = _messageTransmitter;
        minDepositAmount = _minDepositAmount;

        // Approve pool to spend USDC (max approval for gas efficiency)
        usdc.approve(_liquidityPool, type(uint256).max);
    }

    // ============ CCTP Integration ============

    /**
     * @notice Handle USDC received from CCTP transfer
     * @param beneficiary Address that will receive SEED shares
     * @param amount Amount of USDC received
     * @param sourceDomain CCTP domain ID of the source chain
     * @param nonce Unique identifier for this CCTP transfer
     * @dev Called after MessageTransmitter.receiveMessage() mints USDC to this contract
     *      Can be called by anyone - the USDC must already be in this contract
     *      The nonce prevents replay attacks
     */
    function processCCTPDeposit(
        address beneficiary,
        uint256 amount,
        uint32 sourceDomain,
        bytes32 nonce
    ) external nonReentrant {
        // Prevent replay attacks
        if (processedNonces[nonce]) {
            revert NonceAlreadyProcessed(nonce);
        }
        processedNonces[nonce] = true;

        _processDeposit(beneficiary, amount, sourceDomain, nonce);
    }

    /**
     * @notice Direct deposit for users who already have USDC on Base
     * @param amount USDC amount to deposit
     * @dev User must approve this contract to spend their USDC first
     */
    function directDeposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount < minDepositAmount) {
            revert AmountBelowMinimum(amount, minDepositAmount);
        }

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Deposit to pool
        uint256 shares = liquidityPool.deposit(amount, msg.sender);
        if (shares == 0) revert DepositFailed();

        // Update stats
        totalReceived += amount;
        totalDeposited += amount;
        depositCount++;

        emit DirectDeposit(msg.sender, amount, shares);
    }

    // ============ Pending Deposit Functions ============

    /**
     * @notice Claim pending deposit and receive SEED shares
     * @dev Called by users who have pending deposits from failed auto-deposits
     */
    function claimPendingDeposit() external nonReentrant {
        uint256 amount = pendingDeposits[msg.sender];
        if (amount == 0) revert NoPendingDeposit();

        // Clear pending before external call
        pendingDeposits[msg.sender] = 0;
        totalPending -= amount;

        // Deposit to pool
        uint256 shares = liquidityPool.deposit(amount, msg.sender);
        if (shares == 0) {
            // Restore pending if deposit fails
            pendingDeposits[msg.sender] = amount;
            totalPending += amount;
            revert DepositFailed();
        }

        totalDeposited += amount;
        depositCount++;

        emit PendingDepositClaimed(msg.sender, amount, shares);
    }

    /**
     * @notice Withdraw pending deposit as USDC instead of depositing to pool
     * @dev Allows users to receive their USDC directly if they don't want SEED shares
     */
    function withdrawPendingDeposit() external nonReentrant {
        uint256 amount = pendingDeposits[msg.sender];
        if (amount == 0) revert NoPendingDeposit();

        // Clear pending before transfer
        pendingDeposits[msg.sender] = 0;
        totalPending -= amount;

        // Transfer USDC to user
        usdc.safeTransfer(msg.sender, amount);

        emit PendingDepositWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Process pending deposit for a specific user (admin function)
     * @param beneficiary Address with pending deposit
     * @dev Allows admin to process pending deposits on behalf of users
     */
    function processPendingDeposit(address beneficiary) external onlyOwner nonReentrant {
        uint256 amount = pendingDeposits[beneficiary];
        if (amount == 0) revert NoPendingDeposit();

        // Clear pending before external call
        pendingDeposits[beneficiary] = 0;
        totalPending -= amount;

        // Deposit to pool
        uint256 shares = liquidityPool.deposit(amount, beneficiary);
        if (shares == 0) {
            // Restore pending if deposit fails
            pendingDeposits[beneficiary] = amount;
            totalPending += amount;
            revert DepositFailed();
        }

        totalDeposited += amount;
        depositCount++;

        emit PendingDepositClaimed(beneficiary, amount, shares);
    }

    // ============ Internal Functions ============

    /**
     * @notice Process the deposit to LiquidityPool
     * @param beneficiary Recipient of shares
     * @param amount USDC amount
     * @param sourceDomain Source chain domain ID
     * @param nonce CCTP transfer nonce
     */
    function _processDeposit(
        address beneficiary,
        uint256 amount,
        uint32 sourceDomain,
        bytes32 nonce
    ) internal {
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (amount == 0) revert ZeroAmount();

        // Update total received
        totalReceived += amount;

        // Check minimum amount - create pending deposit if below
        if (amount < minDepositAmount) {
            pendingDeposits[beneficiary] += amount;
            totalPending += amount;
            emit PendingDepositCreated(beneficiary, amount, "Amount below minimum");
            return;
        }

        // Verify we have the USDC
        uint256 balance = usdc.balanceOf(address(this)) - totalPending;
        if (balance < amount) {
            // Create pending deposit for whatever we can
            uint256 available = balance;
            if (available > 0) {
                pendingDeposits[beneficiary] += available;
                totalPending += available;
                emit PendingDepositCreated(beneficiary, available, "Insufficient balance");
            }
            return;
        }

        // Deposit to LiquidityPool, mint shares to beneficiary
        try liquidityPool.deposit(amount, beneficiary) returns (uint256 shares) {
            if (shares == 0) {
                // Deposit returned 0 shares - create pending deposit
                pendingDeposits[beneficiary] += amount;
                totalPending += amount;
                emit PendingDepositCreated(beneficiary, amount, "Zero shares returned");
                return;
            }

            totalDeposited += amount;
            depositCount++;

            emit DepositReceived(beneficiary, amount, shares, sourceDomain, nonce);
        } catch {
            // Deposit failed - create pending deposit
            pendingDeposits[beneficiary] += amount;
            totalPending += amount;
            emit PendingDepositCreated(beneficiary, amount, "Deposit failed");
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the CCTP MessageTransmitter address
     * @param _messageTransmitter New MessageTransmitter address
     */
    function setMessageTransmitter(address _messageTransmitter) external onlyOwner {
        address oldTransmitter = messageTransmitter;
        messageTransmitter = _messageTransmitter;
        emit MessageTransmitterUpdated(oldTransmitter, _messageTransmitter);
    }

    /**
     * @notice Update minimum deposit amount
     * @param newMinimum New minimum amount in USDC
     */
    function setMinDepositAmount(uint256 newMinimum) external onlyOwner {
        uint256 oldMinimum = minDepositAmount;
        minDepositAmount = newMinimum;
        emit MinDepositUpdated(oldMinimum, newMinimum);
    }

    /**
     * @notice Emergency withdraw any token stuck in contract
     * @param token Token address (use address(0) for ETH)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, amount, to);
    }

    /**
     * @notice Rescue tokens sent directly to contract by mistake
     * @param token Token to rescue
     * @param to Recipient
     */
    function rescueTokens(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (token == address(0)) revert ZeroAddress();

        // For USDC, only rescue amount not reserved for pending deposits
        uint256 balance;
        if (token == address(usdc)) {
            uint256 fullBalance = IERC20(token).balanceOf(address(this));
            balance = fullBalance > totalPending ? fullBalance - totalPending : 0;
        } else {
            balance = IERC20(token).balanceOf(address(this));
        }

        if (balance > 0) {
            IERC20(token).safeTransfer(to, balance);
            emit EmergencyWithdraw(token, balance, to);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Check if a nonce has been processed
     * @param nonce The nonce to check
     * @return Whether the nonce has been used
     */
    function isNonceProcessed(bytes32 nonce) external view returns (bool) {
        return processedNonces[nonce];
    }

    /**
     * @notice Get pending deposit amount for a user
     * @param user Address to check
     * @return Amount of pending USDC
     */
    function getPendingDeposit(address user) external view returns (uint256) {
        return pendingDeposits[user];
    }

    /**
     * @notice Get contract stats
     * @return _totalReceived Total USDC received
     * @return _totalDeposited Total USDC deposited to pool
     * @return _totalPending Total USDC in pending deposits
     * @return _depositCount Number of successful deposits
     * @return _currentBalance Current USDC balance
     */
    function getStats() external view returns (
        uint256 _totalReceived,
        uint256 _totalDeposited,
        uint256 _totalPending,
        uint256 _depositCount,
        uint256 _currentBalance
    ) {
        return (
            totalReceived,
            totalDeposited,
            totalPending,
            depositCount,
            usdc.balanceOf(address(this))
        );
    }

    /**
     * @notice Preview shares user would receive for a deposit
     * @param amount USDC amount
     * @return shares Expected SEED shares
     */
    function previewDeposit(uint256 amount) external view returns (uint256 shares) {
        return liquidityPool.previewDeposit(amount);
    }

    /**
     * @notice Get chain name from CCTP domain ID
     * @param domainId CCTP domain identifier
     * @return Chain name string
     */
    function getChainName(uint32 domainId) external pure returns (string memory) {
        if (domainId == DOMAIN_ETHEREUM) return "Ethereum";
        if (domainId == DOMAIN_AVALANCHE) return "Avalanche";
        if (domainId == DOMAIN_OP_MAINNET) return "Optimism";
        if (domainId == DOMAIN_ARBITRUM) return "Arbitrum";
        if (domainId == DOMAIN_SOLANA) return "Solana";
        if (domainId == DOMAIN_BASE) return "Base";
        if (domainId == DOMAIN_POLYGON) return "Polygon";
        return "Unknown";
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
