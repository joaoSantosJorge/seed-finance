// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

/**
 * @title SmartRouter
 * @notice Unified entry point for all deposit methods into Seed Finance LiquidityPool
 * @dev Routes deposits based on source:
 *      - Direct: User has USDC on Base → depositDirect()
 *      - CCTP: USDC from other chains via CCTP → handleCCTPDeposit()
 *      - LI.FI: Non-USDC tokens or unsupported chains → handleLiFiDeposit()
 *
 * This contract provides a single interface for the frontend while
 * coordinating with specialized receivers (CCTPReceiver, LiFiReceiver)
 * for cross-chain operations.
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │                        SmartRouter                                │
 * │  ┌───────────────┬───────────────┬──────────────────────────┐   │
 * │  │ depositDirect │ handleCCTP    │ handleLiFi               │   │
 * │  │ (Base USDC)   │ (CCTP USDC)   │ (LI.FI any token)       │   │
 * │  └───────┬───────┴───────┬───────┴─────────┬────────────────┘   │
 * │          │               │                 │                     │
 * │          └───────────────┼─────────────────┘                     │
 * │                          ▼                                       │
 * │                   LiquidityPool                                  │
 * │                   (ERC-4626 vault)                               │
 * └──────────────────────────────────────────────────────────────────┘
 */
contract SmartRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice USDC token address on Base
    IERC20 public immutable usdc;

    /// @notice LiquidityPool (ERC-4626 vault) address
    IERC4626 public immutable liquidityPool;

    /// @notice CCTPReceiver contract address
    address public cctpReceiver;

    /// @notice LiFiReceiver contract address
    address public lifiReceiver;

    /// @notice Minimum deposit amount (prevents dust attacks)
    uint256 public minDepositAmount;

    /// @notice Mapping of authorized handlers (CCTP/LI.FI receivers)
    mapping(address => bool) public authorizedHandlers;

    /// @notice Total deposits routed through this contract
    uint256 public totalRouted;

    /// @notice Count of deposits by method
    mapping(DepositMethod => uint256) public depositsByMethod;

    // ============ Enums ============

    enum DepositMethod {
        Direct,  // USDC on Base
        CCTP,    // USDC from other chains via CCTP
        LiFi     // Any token via LI.FI bridge
    }

    // ============ Events ============

    event DirectDeposit(
        address indexed user,
        uint256 usdcAmount,
        uint256 sharesReceived
    );

    event CCTPDepositHandled(
        address indexed beneficiary,
        uint256 amount,
        uint256 sharesReceived,
        uint32 sourceDomain
    );

    event LiFiDepositHandled(
        address indexed beneficiary,
        uint256 amount,
        uint256 sharesReceived,
        bytes32 transferId
    );

    event HandlerUpdated(address indexed handler, bool authorized);
    event CCTPReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event LiFiReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event MinDepositUpdated(uint256 oldAmount, uint256 newAmount);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ============ Errors ============

    error UnauthorizedHandler(address handler);
    error ZeroAmount();
    error ZeroAddress();
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error DepositFailed();
    error TransferFailed();
    error InsufficientBalance();

    // ============ Constructor ============

    /**
     * @notice Initialize the SmartRouter
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

    // ============ Direct Deposit (Base USDC) ============

    /**
     * @notice Direct deposit for users who have USDC on Base
     * @param amount USDC amount to deposit
     * @return shares Amount of SEED shares received
     * @dev User must approve this contract to spend their USDC first
     */
    function depositDirect(uint256 amount) external nonReentrant returns (uint256 shares) {
        return _depositDirect(msg.sender, amount, msg.sender);
    }

    /**
     * @notice Direct deposit on behalf of another user
     * @param beneficiary Address that will receive SEED shares
     * @param amount USDC amount to deposit
     * @return shares Amount of SEED shares received
     * @dev Caller must approve this contract to spend their USDC
     */
    function depositDirectFor(
        address beneficiary,
        uint256 amount
    ) external nonReentrant returns (uint256 shares) {
        return _depositDirect(msg.sender, amount, beneficiary);
    }

    /**
     * @notice Internal direct deposit logic
     */
    function _depositDirect(
        address from,
        uint256 amount,
        address beneficiary
    ) internal returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount < minDepositAmount) {
            revert AmountBelowMinimum(amount, minDepositAmount);
        }

        // Transfer USDC from sender
        usdc.safeTransferFrom(from, address(this), amount);

        // Deposit to pool
        shares = liquidityPool.deposit(amount, beneficiary);
        if (shares == 0) revert DepositFailed();

        // Update stats
        totalRouted += amount;
        depositsByMethod[DepositMethod.Direct]++;

        emit DirectDeposit(beneficiary, amount, shares);
    }

    // ============ CCTP Handler ============

    /**
     * @notice Handle USDC deposit from CCTP
     * @param beneficiary Address that will receive SEED shares
     * @param amount USDC amount received from CCTP
     * @param sourceDomain CCTP source chain domain ID
     * @return shares Amount of SEED shares received
     * @dev Called by CCTPReceiver after receiving USDC via CCTP
     *      USDC should already be in this contract
     */
    function handleCCTPDeposit(
        address beneficiary,
        uint256 amount,
        uint32 sourceDomain
    ) external nonReentrant returns (uint256 shares) {
        // Only authorized handlers (CCTPReceiver)
        if (!authorizedHandlers[msg.sender]) {
            revert UnauthorizedHandler(msg.sender);
        }
        if (amount == 0) revert ZeroAmount();
        if (beneficiary == address(0)) revert ZeroAddress();

        // Verify we have the USDC
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();

        // Deposit to pool
        shares = liquidityPool.deposit(amount, beneficiary);
        if (shares == 0) revert DepositFailed();

        // Update stats
        totalRouted += amount;
        depositsByMethod[DepositMethod.CCTP]++;

        emit CCTPDepositHandled(beneficiary, amount, shares, sourceDomain);
    }

    // ============ LI.FI Handler ============

    /**
     * @notice Handle USDC deposit from LI.FI bridge
     * @param beneficiary Address that will receive SEED shares
     * @param amount USDC amount received from LI.FI
     * @param transferId LI.FI transfer tracking ID
     * @return shares Amount of SEED shares received
     * @dev Called by LiFiReceiver after bridging/swapping to USDC
     *      USDC should already be in this contract
     */
    function handleLiFiDeposit(
        address beneficiary,
        uint256 amount,
        bytes32 transferId
    ) external nonReentrant returns (uint256 shares) {
        // Only authorized handlers (LiFiReceiver)
        if (!authorizedHandlers[msg.sender]) {
            revert UnauthorizedHandler(msg.sender);
        }
        if (amount == 0) revert ZeroAmount();
        if (beneficiary == address(0)) revert ZeroAddress();

        // Verify we have the USDC
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();

        // Deposit to pool
        shares = liquidityPool.deposit(amount, beneficiary);
        if (shares == 0) revert DepositFailed();

        // Update stats
        totalRouted += amount;
        depositsByMethod[DepositMethod.LiFi]++;

        emit LiFiDepositHandled(beneficiary, amount, shares, transferId);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set CCTPReceiver contract address
     * @param _cctpReceiver New CCTPReceiver address
     */
    function setCCTPReceiver(address _cctpReceiver) external onlyOwner {
        if (_cctpReceiver == address(0)) revert ZeroAddress();

        // Remove old receiver from authorized handlers
        if (cctpReceiver != address(0)) {
            authorizedHandlers[cctpReceiver] = false;
        }

        address oldReceiver = cctpReceiver;
        cctpReceiver = _cctpReceiver;
        authorizedHandlers[_cctpReceiver] = true;

        emit CCTPReceiverUpdated(oldReceiver, _cctpReceiver);
        emit HandlerUpdated(_cctpReceiver, true);
    }

    /**
     * @notice Set LiFiReceiver contract address
     * @param _lifiReceiver New LiFiReceiver address
     */
    function setLiFiReceiver(address _lifiReceiver) external onlyOwner {
        if (_lifiReceiver == address(0)) revert ZeroAddress();

        // Remove old receiver from authorized handlers
        if (lifiReceiver != address(0)) {
            authorizedHandlers[lifiReceiver] = false;
        }

        address oldReceiver = lifiReceiver;
        lifiReceiver = _lifiReceiver;
        authorizedHandlers[_lifiReceiver] = true;

        emit LiFiReceiverUpdated(oldReceiver, _lifiReceiver);
        emit HandlerUpdated(_lifiReceiver, true);
    }

    /**
     * @notice Update authorized handler status
     * @param handler Handler address
     * @param authorized Whether to authorize or revoke
     */
    function setHandler(address handler, bool authorized) external onlyOwner {
        if (handler == address(0)) revert ZeroAddress();
        authorizedHandlers[handler] = authorized;
        emit HandlerUpdated(handler, authorized);
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

    // ============ View Functions ============

    /**
     * @notice Check if an address is an authorized handler
     * @param handler Address to check
     * @return Whether the address is authorized
     */
    function isAuthorizedHandler(address handler) external view returns (bool) {
        return authorizedHandlers[handler];
    }

    /**
     * @notice Get contract stats
     * @return _totalRouted Total USDC routed through this contract
     * @return _directCount Number of direct deposits
     * @return _cctpCount Number of CCTP deposits
     * @return _lifiCount Number of LI.FI deposits
     * @return _currentBalance Current USDC balance
     */
    function getStats() external view returns (
        uint256 _totalRouted,
        uint256 _directCount,
        uint256 _cctpCount,
        uint256 _lifiCount,
        uint256 _currentBalance
    ) {
        return (
            totalRouted,
            depositsByMethod[DepositMethod.Direct],
            depositsByMethod[DepositMethod.CCTP],
            depositsByMethod[DepositMethod.LiFi],
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
     * @notice Get current share price (USDC per SEED share)
     * @return Price in USDC (6 decimals)
     */
    function getSharePrice() external view returns (uint256) {
        uint256 supply = liquidityPool.totalSupply();
        if (supply == 0) return 1e6; // 1:1 if no shares
        return (liquidityPool.totalAssets() * 1e6) / supply;
    }

    /**
     * @notice Get deposit count by method
     * @param method Deposit method to query
     * @return count Number of deposits
     */
    function getDepositCount(DepositMethod method) external view returns (uint256 count) {
        return depositsByMethod[method];
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
