// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/ITreasuryStrategy.sol";

/**
 * @title IUSYC
 * @notice Interface for Hashnote USYC token
 * @dev USYC is a yield-bearing stablecoin backed by US Treasury Bills
 */
interface IUSYC {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function balanceOf(address account) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * @title USYCStrategy
 * @notice Treasury strategy for Hashnote USYC (US Treasury yield)
 * @dev Deposits USDC into USYC to earn US Treasury bill yields (~4-5% APY)
 *
 * USYC Properties:
 * - Backed 1:1 by US Treasury Bills
 * - Daily yield accrual
 * - Instant redemption for qualified holders
 * - Compliant with securities regulations
 *
 * On Base:
 * - USYC Address: 0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b
 */
contract USYCStrategy is ITreasuryStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    string public constant override name = "Hashnote USYC Treasury";

    // ============ State Variables ============

    /// @notice USDC token (underlying asset)
    IERC20 public immutable usdc;

    /// @notice USYC token
    IUSYC public immutable usyc;

    /// @notice Address of the TreasuryManager
    address public treasuryManager;

    /// @notice Whether the strategy is active
    bool public override isActive;

    /// @notice Estimated APY in basis points (updated periodically)
    uint256 public override estimatedAPY;

    /// @notice Total deposited (in USDC terms)
    uint256 public totalDeposited;

    // ============ Events ============

    event TreasuryManagerUpdated(address indexed oldManager, address indexed newManager);
    event APYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============ Errors ============

    error OnlyTreasuryManager();
    error StrategyNotActive();
    error ZeroAmount();
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyManager() {
        if (msg.sender != treasuryManager) revert OnlyTreasuryManager();
        _;
    }

    modifier whenActive() {
        if (!isActive) revert StrategyNotActive();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the USYC strategy
     * @param _usdc USDC token address
     * @param _usyc USYC token address
     * @param _treasuryManager TreasuryManager contract address
     */
    constructor(
        address _usdc,
        address _usyc,
        address _treasuryManager
    ) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_usyc == address(0)) revert ZeroAddress();
        if (_treasuryManager == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        usyc = IUSYC(_usyc);
        treasuryManager = _treasuryManager;
        isActive = true;

        // Initial APY estimate (4.5% - typical T-bill rate)
        estimatedAPY = 450;

        // Approve USYC to spend USDC
        usdc.approve(_usyc, type(uint256).max);
    }

    // ============ Core Functions ============

    /**
     * @notice Deposit USDC into USYC
     * @param amount Amount of USDC to deposit
     * @return shares Amount of USYC shares received
     */
    function deposit(
        uint256 amount
    ) external override onlyManager whenActive nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        // Transfer USDC from TreasuryManager
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Deposit into USYC
        shares = usyc.deposit(amount, address(this));

        totalDeposited += amount;

        emit Deposited(msg.sender, amount, shares);
    }

    /**
     * @notice Withdraw USDC from USYC
     * @param amount Amount of USDC to withdraw
     * @return received Actual amount received
     */
    function withdraw(
        uint256 amount
    ) external override onlyManager nonReentrant returns (uint256 received) {
        if (amount == 0) revert ZeroAmount();

        // Calculate shares needed
        uint256 sharesToRedeem = usyc.convertToShares(amount);
        uint256 balance = usyc.balanceOf(address(this));

        // Cap to available balance
        if (sharesToRedeem > balance) {
            sharesToRedeem = balance;
        }

        // Redeem USYC for USDC
        received = usyc.redeem(sharesToRedeem, address(this), address(this));

        // Update tracking
        if (received >= totalDeposited) {
            totalDeposited = 0;
        } else {
            totalDeposited -= received;
        }

        // Transfer to TreasuryManager
        usdc.safeTransfer(msg.sender, received);

        emit Withdrawn(msg.sender, amount, received);
    }

    /**
     * @notice Withdraw all USDC from USYC
     * @return received Total amount received
     */
    function withdrawAll() external override onlyManager nonReentrant returns (uint256 received) {
        uint256 shares = usyc.balanceOf(address(this));
        if (shares == 0) return 0;

        // Redeem all USYC
        received = usyc.redeem(shares, address(this), address(this));

        totalDeposited = 0;

        // Transfer to TreasuryManager
        usdc.safeTransfer(msg.sender, received);

        emit Withdrawn(msg.sender, received, received);
    }

    // ============ View Functions ============

    /**
     * @notice Get total value in USDC terms
     * @return Total value including accrued yield
     */
    function totalValue() external view override returns (uint256) {
        uint256 shares = usyc.balanceOf(address(this));
        if (shares == 0) return 0;
        return usyc.convertToAssets(shares);
    }

    /**
     * @notice Get the underlying asset address
     * @return USDC address
     */
    function asset() external view override returns (address) {
        return address(usdc);
    }

    /**
     * @notice Check if instant withdrawals are supported
     * @return True - USYC supports instant redemption
     */
    function supportsInstantWithdraw() external pure override returns (bool) {
        return true;
    }

    /**
     * @notice Get maximum instant withdrawal amount
     * @return Current total value (all can be withdrawn instantly)
     */
    function maxInstantWithdraw() external view override returns (uint256) {
        uint256 shares = usyc.balanceOf(address(this));
        if (shares == 0) return 0;
        return usyc.convertToAssets(shares);
    }

    /**
     * @notice Get current USYC balance
     * @return USYC token balance
     */
    function usycBalance() external view returns (uint256) {
        return usyc.balanceOf(address(this));
    }

    /**
     * @notice Calculate yield earned
     * @return yield Amount of yield earned (totalValue - totalDeposited)
     */
    function yieldEarned() external view returns (uint256 yield) {
        uint256 currentValue = this.totalValue();
        if (currentValue > totalDeposited) {
            yield = currentValue - totalDeposited;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the TreasuryManager address
     * @param _treasuryManager New TreasuryManager address
     */
    function setTreasuryManager(address _treasuryManager) external onlyOwner {
        if (_treasuryManager == address(0)) revert ZeroAddress();

        address oldManager = treasuryManager;
        treasuryManager = _treasuryManager;

        emit TreasuryManagerUpdated(oldManager, _treasuryManager);
    }

    /**
     * @notice Update estimated APY
     * @param _apy New APY in basis points
     */
    function setEstimatedAPY(uint256 _apy) external onlyOwner {
        uint256 oldAPY = estimatedAPY;
        estimatedAPY = _apy;
        emit APYUpdated(oldAPY, _apy);
    }

    /**
     * @notice Activate the strategy
     */
    function activate() external onlyOwner {
        isActive = true;
        emit StrategyStatusChanged(true);
    }

    /**
     * @notice Deactivate the strategy
     */
    function deactivate() external onlyOwner {
        isActive = false;
        emit StrategyStatusChanged(false);
    }

    /**
     * @notice Emergency withdraw to owner
     * @dev Only use in emergencies
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        // Withdraw all USYC
        uint256 shares = usyc.balanceOf(address(this));
        if (shares > 0) {
            usyc.redeem(shares, owner(), address(this));
        }

        // Transfer any USDC
        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance > 0) {
            usdc.safeTransfer(owner(), usdcBalance);
        }

        totalDeposited = 0;
        isActive = false;
    }

    /**
     * @notice Rescue stuck tokens (not USDC or USYC)
     * @param token Token to rescue
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(usdc) && token != address(usyc), "Cannot rescue core tokens");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
