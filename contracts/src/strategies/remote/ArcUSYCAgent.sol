// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../../interfaces/ITokenMessenger.sol";

/**
 * @title IUSYC
 * @notice Interface for Hashnote USYC (ERC-4626 vault)
 */
interface IUSYC {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function balanceOf(address account) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function asset() external view returns (address);
}

/**
 * @title ArcUSYCAgent
 * @notice Remote agent on Arc that manages USYC deposits
 * @dev Deployed on Arc, receives USDC via CCTP, deposits to USYC
 *
 * Flow:
 * 1. CCTP mints USDC to this contract
 * 2. Keeper calls processDeposit() to deposit into USYC
 * 3. On withdrawal request, keeper calls initiateWithdrawal()
 * 4. Agent redeems from USYC and bridges back via CCTP
 *
 * Addresses (Arc):
 * - USDC: 0x3600000000000000000000000000000000000000
 * - USYC: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
 * - TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
 */
contract ArcUSYCAgent is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Base CCTP domain
    uint32 public constant BASE_DOMAIN = 6;

    /// @notice Arc CCTP domain
    uint32 public constant ARC_DOMAIN = 26;

    /// @notice USDC on Arc (native USDC address)
    address public constant USDC_ARC = 0x3600000000000000000000000000000000000000;

    /// @notice USYC on Arc
    address public constant USYC_ARC = 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C;

    /// @notice CCTP TokenMessengerV2 on Arc
    address public constant TOKEN_MESSENGER_ARC = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;

    // ============ State Variables ============

    /// @notice USDC token
    IERC20 public usdc;

    /// @notice USYC vault
    IUSYC public usyc;

    /// @notice CCTP TokenMessenger
    ITokenMessenger public tokenMessenger;

    /// @notice Strategy contract on Base
    address public homeStrategy;

    /// @notice Authorized keepers
    mapping(address => bool) public keepers;

    /// @notice Total deposited into USYC
    uint256 public totalDeposited;

    /// @notice Transfer counter
    uint256 internal _transferCounter;

    // ============ Events ============

    event DepositProcessed(bytes32 indexed transferId, uint256 amount, uint256 sharesReceived);
    event WithdrawalInitiated(bytes32 indexed transferId, uint256 amount);
    event WithdrawalCompleted(bytes32 indexed transferId, uint64 nonce, uint256 amountBridged);
    event ValueReported(uint256 value, uint256 timestamp);
    event KeeperUpdated(address indexed keeper, bool authorized);
    event HomeStrategyUpdated(address oldStrategy, address newStrategy);

    // ============ Errors ============

    error OnlyKeeper();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error CCTPBurnFailed();

    // ============ Modifiers ============

    modifier onlyKeeper() {
        if (!keepers[msg.sender]) revert OnlyKeeper();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the agent
     * @param _homeStrategy ArcUSYCStrategy address on Base
     * @param _usdc USDC address (use default if zero)
     * @param _usyc USYC address (use default if zero)
     * @param _tokenMessenger TokenMessenger address (use default if zero)
     */
    constructor(
        address _homeStrategy,
        address _usdc,
        address _usyc,
        address _tokenMessenger
    ) Ownable(msg.sender) {
        if (_homeStrategy == address(0)) revert ZeroAddress();

        homeStrategy = _homeStrategy;

        usdc = IERC20(_usdc != address(0) ? _usdc : USDC_ARC);
        usyc = IUSYC(_usyc != address(0) ? _usyc : USYC_ARC);
        tokenMessenger = ITokenMessenger(_tokenMessenger != address(0) ? _tokenMessenger : TOKEN_MESSENGER_ARC);

        // Owner is keeper by default
        keepers[msg.sender] = true;

        // Approve USYC to spend USDC
        usdc.approve(address(usyc), type(uint256).max);

        // Approve TokenMessenger to burn USDC
        usdc.approve(address(tokenMessenger), type(uint256).max);
    }

    // ============ Deposit Functions ============

    /**
     * @notice Process incoming deposit (deposit to USYC)
     * @param transferId CCTP transfer identifier
     * @dev Called by keeper after CCTP mints USDC
     */
    function processDeposit(bytes32 transferId) external onlyKeeper nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        // Deposit to USYC
        uint256 sharesBefore = usyc.balanceOf(address(this));
        uint256 sharesReceived = usyc.deposit(balance, address(this));

        totalDeposited += balance;

        emit DepositProcessed(transferId, balance, sharesReceived);
    }

    /**
     * @notice Auto-deposit any USDC received
     */
    function autoDeposit() external onlyKeeper nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        uint256 sharesReceived = usyc.deposit(balance, address(this));
        totalDeposited += balance;

        bytes32 autoId = keccak256(abi.encodePacked("auto", block.timestamp, balance));
        emit DepositProcessed(autoId, balance, sharesReceived);
    }

    // ============ Withdrawal Functions ============

    /**
     * @notice Initiate withdrawal from USYC and bridge back to Base
     * @param transferId Withdrawal transfer identifier from home strategy
     * @param amount Amount to withdraw
     */
    function initiateWithdrawal(bytes32 transferId, uint256 amount) external onlyKeeper nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Get current value
        uint256 currentValue = getCurrentValue();
        if (amount > currentValue) {
            amount = currentValue;
        }

        emit WithdrawalInitiated(transferId, amount);

        // Calculate shares to redeem
        uint256 sharesToRedeem = usyc.convertToShares(amount);
        uint256 shareBalance = usyc.balanceOf(address(this));

        if (sharesToRedeem > shareBalance) {
            sharesToRedeem = shareBalance;
        }

        // Redeem from USYC
        uint256 redeemed = usyc.redeem(sharesToRedeem, address(this), address(this));

        if (redeemed >= totalDeposited) {
            totalDeposited = 0;
        } else {
            totalDeposited -= redeemed;
        }

        // Bridge back via CCTP
        uint64 nonce = _bridgeToBase(redeemed);

        emit WithdrawalCompleted(transferId, nonce, redeemed);
    }

    /**
     * @notice Withdraw all from USYC and bridge back
     */
    function withdrawAll() external onlyKeeper nonReentrant {
        uint256 shareBalance = usyc.balanceOf(address(this));
        if (shareBalance == 0) revert ZeroAmount();

        bytes32 transferId = _generateTransferId();
        uint256 amount = usyc.convertToAssets(shareBalance);

        emit WithdrawalInitiated(transferId, amount);

        // Redeem all from USYC
        uint256 redeemed = usyc.redeem(shareBalance, address(this), address(this));

        totalDeposited = 0;

        // Bridge back
        uint64 nonce = _bridgeToBase(redeemed);

        emit WithdrawalCompleted(transferId, nonce, redeemed);
    }

    // ============ Value Reporting ============

    /**
     * @notice Get current value in USDC terms
     * @return Current value of USYC holdings
     */
    function getCurrentValue() public view returns (uint256) {
        uint256 shares = usyc.balanceOf(address(this));
        if (shares == 0) return 0;
        return usyc.convertToAssets(shares);
    }

    /**
     * @notice Report current value (for keeper to relay to home strategy)
     */
    function reportValue() external onlyKeeper {
        uint256 value = getCurrentValue();
        emit ValueReported(value, block.timestamp);
    }

    /**
     * @notice Get detailed position info
     */
    function getPosition() external view returns (
        uint256 usycShares,
        uint256 usycValue,
        uint256 usdcBalance,
        uint256 totalValue,
        uint256 yieldEarned
    ) {
        usycShares = usyc.balanceOf(address(this));
        usycValue = usycShares > 0 ? usyc.convertToAssets(usycShares) : 0;
        usdcBalance = usdc.balanceOf(address(this));
        totalValue = usycValue + usdcBalance;
        yieldEarned = totalValue > totalDeposited ? totalValue - totalDeposited : 0;
    }

    // ============ Internal Functions ============

    /**
     * @notice Bridge USDC back to Base via CCTP
     * @param amount Amount to bridge
     * @return nonce CCTP message nonce
     */
    function _bridgeToBase(uint256 amount) internal returns (uint64 nonce) {
        bytes32 mintRecipient = bytes32(uint256(uint160(homeStrategy)));

        try tokenMessenger.depositForBurn(
            amount,
            BASE_DOMAIN,
            mintRecipient,
            address(usdc)
        ) returns (uint64 _nonce) {
            nonce = _nonce;
        } catch {
            revert CCTPBurnFailed();
        }
    }

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

    // ============ Admin Functions ============

    /**
     * @notice Set keeper authorization
     */
    function setKeeper(address keeper, bool authorized) external onlyOwner {
        if (keeper == address(0)) revert ZeroAddress();
        keepers[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    /**
     * @notice Update home strategy address
     */
    function setHomeStrategy(address newStrategy) external onlyOwner {
        if (newStrategy == address(0)) revert ZeroAddress();
        address oldStrategy = homeStrategy;
        homeStrategy = newStrategy;
        emit HomeStrategyUpdated(oldStrategy, newStrategy);
    }

    /**
     * @notice Emergency withdraw to owner
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        // Redeem from USYC
        uint256 shares = usyc.balanceOf(address(this));
        if (shares > 0) {
            usyc.redeem(shares, owner(), address(this));
        }

        // Transfer any remaining USDC
        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance > 0) {
            usdc.safeTransfer(owner(), usdcBalance);
        }

        totalDeposited = 0;
    }

    /**
     * @notice Rescue stuck tokens
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(usdc) && token != address(usyc), "Cannot rescue core tokens");
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
