// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

/**
 * @title LiFiReceiver
 * @notice Receives USDC from LI.FI bridges and auto-deposits to LiquidityPool
 * @dev This contract is the destination for LI.FI cross-chain swaps/bridges.
 *      When LI.FI sends USDC here, it automatically deposits into the ERC-4626
 *      LiquidityPool and transfers the resulting SEED shares to the user.
 *
 * Flow:
 * 1. User initiates cross-chain swap via LI.FI widget (any token, any chain)
 * 2. LI.FI bridges/swaps to USDC on Base
 * 3. LI.FI executor calls receiveAndDeposit() with USDC
 * 4. This contract deposits USDC to LiquidityPool
 * 5. User receives SEED shares
 */
contract LiFiReceiver is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice USDC token address on Base
    IERC20 public immutable usdc;

    /// @notice LiquidityPool (ERC-4626 vault) address
    IERC4626 public immutable liquidityPool;

    /// @notice Authorized LI.FI executor addresses
    mapping(address => bool) public authorizedExecutors;

    /// @notice Minimum deposit amount (prevents dust attacks)
    uint256 public minDepositAmount;

    /// @notice Total USDC received through this contract
    uint256 public totalReceived;

    /// @notice Total deposits made to pool
    uint256 public totalDeposited;

    /// @notice Number of successful deposits
    uint256 public depositCount;

    // ============ Events ============

    event DepositReceived(
        address indexed user,
        uint256 usdcAmount,
        uint256 sharesReceived,
        bytes32 indexed transferId
    );

    event DirectDeposit(
        address indexed user,
        uint256 usdcAmount,
        uint256 sharesReceived
    );

    event FallbackToUser(
        address indexed user,
        uint256 amount,
        string reason
    );

    event ExecutorUpdated(address indexed executor, bool authorized);
    event MinDepositUpdated(uint256 oldAmount, uint256 newAmount);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ============ Errors ============

    error UnauthorizedExecutor(address executor);
    error InvalidUser();
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error ZeroAmount();
    error ZeroAddress();
    error DepositFailed();
    error TransferFailed();

    // ============ Constructor ============

    /**
     * @notice Initialize the LiFiReceiver
     * @param _usdc USDC token address on Base
     * @param _liquidityPool LiquidityPool (ERC-4626 vault) address
     * @param _minDepositAmount Minimum deposit amount in USDC
     */
    constructor(
        address _usdc,
        address _liquidityPool,
        uint256 _minDepositAmount
    ) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_liquidityPool == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        liquidityPool = IERC4626(_liquidityPool);
        minDepositAmount = _minDepositAmount;

        // Approve pool to spend USDC (max approval for gas efficiency)
        usdc.approve(_liquidityPool, type(uint256).max);
    }

    // ============ LI.FI Integration ============

    /**
     * @notice Receive USDC from LI.FI and deposit to LiquidityPool
     * @param user Final recipient of SEED shares
     * @param amount USDC amount received from LI.FI
     * @param transferId LI.FI transfer tracking ID
     * @dev Called by authorized LI.FI executors after bridge completes
     */
    function receiveAndDeposit(
        address user,
        uint256 amount,
        bytes32 transferId
    ) external nonReentrant {
        // Validate executor
        if (!authorizedExecutors[msg.sender]) {
            revert UnauthorizedExecutor(msg.sender);
        }

        _processDeposit(user, amount, transferId);
    }

    /**
     * @notice Receive USDC from LI.FI with calldata (alternative signature)
     * @param user Final recipient of SEED shares
     * @param amount USDC amount received
     * @param transferId LI.FI transfer tracking ID
     * @param data Additional calldata (unused, for future compatibility)
     */
    function receiveAndDeposit(
        address user,
        uint256 amount,
        bytes32 transferId,
        bytes calldata data
    ) external nonReentrant {
        // Validate executor
        if (!authorizedExecutors[msg.sender]) {
            revert UnauthorizedExecutor(msg.sender);
        }

        // data is reserved for future use (e.g., referral codes, custom routing)
        (data);

        _processDeposit(user, amount, transferId);
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

    // ============ Internal Functions ============

    /**
     * @notice Process the deposit to LiquidityPool
     * @param user Recipient of shares
     * @param amount USDC amount
     * @param transferId LI.FI transfer ID for tracking
     */
    function _processDeposit(
        address user,
        uint256 amount,
        bytes32 transferId
    ) internal {
        if (user == address(0)) revert InvalidUser();
        if (amount == 0) revert ZeroAmount();

        // Update total received
        totalReceived += amount;

        // Check minimum amount
        if (amount < minDepositAmount) {
            // Send USDC directly to user instead of reverting
            usdc.safeTransfer(user, amount);
            emit FallbackToUser(user, amount, "Amount below minimum");
            return;
        }

        // Verify we have the USDC (LI.FI should have transferred it)
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) {
            // Fallback: transfer whatever we have to user
            if (balance > 0) {
                usdc.safeTransfer(user, balance);
                emit FallbackToUser(user, balance, "Insufficient balance");
            }
            return;
        }

        // Deposit to LiquidityPool, mint shares to user
        try liquidityPool.deposit(amount, user) returns (uint256 shares) {
            if (shares == 0) {
                // Deposit returned 0 shares - send USDC to user
                usdc.safeTransfer(user, amount);
                emit FallbackToUser(user, amount, "Zero shares returned");
                return;
            }

            totalDeposited += amount;
            depositCount++;

            emit DepositReceived(user, amount, shares, transferId);
        } catch {
            // Deposit failed - send USDC to user as fallback
            usdc.safeTransfer(user, amount);
            emit FallbackToUser(user, amount, "Deposit failed");
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Set authorized LI.FI executor
     * @param executor Address of the LI.FI executor
     * @param authorized Whether to authorize or revoke
     */
    function setExecutor(address executor, bool authorized) external onlyOwner {
        if (executor == address(0)) revert ZeroAddress();
        authorizedExecutors[executor] = authorized;
        emit ExecutorUpdated(executor, authorized);
    }

    /**
     * @notice Batch set multiple executors
     * @param executors Array of executor addresses
     * @param authorized Whether to authorize or revoke all
     */
    function setExecutors(address[] calldata executors, bool authorized) external onlyOwner {
        for (uint256 i = 0; i < executors.length; i++) {
            if (executors[i] == address(0)) revert ZeroAddress();
            authorizedExecutors[executors[i]] = authorized;
            emit ExecutorUpdated(executors[i], authorized);
        }
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

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(to, balance);
            emit EmergencyWithdraw(token, balance, to);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Check if an address is an authorized executor
     * @param executor Address to check
     * @return Whether the address is authorized
     */
    function isAuthorizedExecutor(address executor) external view returns (bool) {
        return authorizedExecutors[executor];
    }

    /**
     * @notice Get contract stats
     * @return _totalReceived Total USDC received
     * @return _totalDeposited Total USDC deposited to pool
     * @return _depositCount Number of successful deposits
     * @return _currentBalance Current USDC balance
     */
    function getStats() external view returns (
        uint256 _totalReceived,
        uint256 _totalDeposited,
        uint256 _depositCount,
        uint256 _currentBalance
    ) {
        return (
            totalReceived,
            totalDeposited,
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

    // ============ Receive ETH ============

    receive() external payable {}
}
