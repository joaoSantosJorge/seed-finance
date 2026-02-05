// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockAToken
 * @notice Mock Aave aToken for testing
 * @dev Represents the yield-bearing aUSDC token
 */
contract MockAToken is ERC20 {
    using SafeERC20 for IERC20;

    /// @notice Underlying asset (USDC)
    IERC20 public immutable underlying;

    /// @notice Pool that controls this aToken
    address public pool;

    /// @notice Exchange rate (scaled by 1e18, starts at 1:1)
    uint256 public exchangeRate = 1e18;

    constructor(
        string memory name_,
        string memory symbol_,
        address underlying_,
        address pool_
    ) ERC20(name_, symbol_) {
        underlying = IERC20(underlying_);
        pool = pool_;
    }

    /**
     * @notice Mint aTokens (called by pool on supply)
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == pool, "Only pool");
        // Convert underlying amount to aToken amount using exchange rate
        uint256 aTokenAmount = (amount * 1e18) / exchangeRate;
        _mint(to, aTokenAmount);
    }

    /**
     * @notice Burn aTokens (called by pool on withdraw)
     */
    function burn(address from, uint256 aTokenAmount) external returns (uint256 underlyingAmount) {
        require(msg.sender == pool, "Only pool");
        // Convert aToken amount to underlying using exchange rate
        underlyingAmount = (aTokenAmount * exchangeRate) / 1e18;
        _burn(from, aTokenAmount);
    }

    /**
     * @notice Get underlying value of aToken balance
     */
    function scaledBalanceOf(address user) external view returns (uint256) {
        return (balanceOf(user) * exchangeRate) / 1e18;
    }

    /**
     * @notice Update exchange rate (simulates yield accrual)
     */
    function setExchangeRate(uint256 newRate) external {
        require(msg.sender == pool, "Only pool");
        exchangeRate = newRate;
    }

    /**
     * @notice Override decimals to match USDC
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/**
 * @title MockAavePool
 * @notice Simulates Aave V3 Pool for testing cross-chain strategies
 * @dev Provides supply/withdraw functionality with configurable yield
 *
 * Aave V3 Pool (Arbitrum): 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 * aUSDC (Arbitrum): 0x724dc807b04555b71ed48a6896b6F41593b8C637
 */
contract MockAavePool {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice USDC token
    IERC20 public usdc;

    /// @notice aUSDC token
    MockAToken public aToken;

    /// @notice APY in basis points (e.g., 400 = 4%)
    uint256 public apyBps = 400;

    /// @notice Last yield accrual timestamp
    uint256 public lastAccrualTime;

    /// @notice Total supplied amount
    uint256 public totalSupplied;

    // ============ Events ============

    event Supply(
        address indexed reserve,
        address indexed user,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 referralCode
    );

    event Withdraw(
        address indexed reserve,
        address indexed user,
        address indexed to,
        uint256 amount
    );

    event YieldAccrued(uint256 oldRate, uint256 newRate, uint256 yieldAmount);

    // ============ Constructor ============

    constructor(address _usdc) {
        usdc = IERC20(_usdc);

        // Deploy aToken
        aToken = new MockAToken(
            "Aave Arbitrum USDC",
            "aArbUSDC",
            _usdc,
            address(this)
        );

        lastAccrualTime = block.timestamp;
    }

    // ============ Aave Pool Functions ============

    /**
     * @notice Supply USDC to the pool
     * @param asset Asset to supply (must be USDC)
     * @param amount Amount to supply
     * @param onBehalfOf Address to receive aTokens
     * @param referralCode Referral code (unused)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        require(asset == address(usdc), "Only USDC");
        require(amount > 0, "Amount must be > 0");

        // Accrue yield before supply
        _accrueYield();

        // Transfer USDC from sender
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Mint aTokens to recipient
        aToken.mint(onBehalfOf, amount);

        totalSupplied += amount;

        emit Supply(asset, msg.sender, onBehalfOf, amount, referralCode);
    }

    /**
     * @notice Withdraw USDC from the pool
     * @param asset Asset to withdraw (must be USDC)
     * @param amount Amount to withdraw (use type(uint256).max for all)
     * @param to Address to receive USDC
     * @return withdrawn Actual amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256 withdrawn) {
        require(asset == address(usdc), "Only USDC");

        // Accrue yield before withdraw
        _accrueYield();

        uint256 aTokenBalance = aToken.balanceOf(msg.sender);
        require(aTokenBalance > 0, "No balance");

        // Calculate underlying value
        uint256 underlyingBalance = (aTokenBalance * aToken.exchangeRate()) / 1e18;

        // Handle max withdrawal
        if (amount == type(uint256).max) {
            amount = underlyingBalance;
        }
        require(amount <= underlyingBalance, "Insufficient balance");

        // Calculate aTokens to burn
        uint256 aTokensToBurn = (amount * 1e18) / aToken.exchangeRate();
        if (aTokensToBurn > aTokenBalance) {
            aTokensToBurn = aTokenBalance;
        }

        // Burn aTokens and get underlying amount
        withdrawn = aToken.burn(msg.sender, aTokensToBurn);

        // Transfer USDC
        usdc.safeTransfer(to, withdrawn);

        if (withdrawn >= totalSupplied) {
            totalSupplied = 0;
        } else {
            totalSupplied -= withdrawn;
        }

        emit Withdraw(asset, msg.sender, to, withdrawn);
    }

    // ============ Yield Functions ============

    /**
     * @notice Manually accrue yield (for testing)
     * @dev In production, yield accrues automatically
     */
    function accrueYield() external {
        _accrueYield();
    }

    /**
     * @notice Simulate time passing with yield accrual
     * @param secondsPassed Seconds to simulate
     */
    function simulateTimePassage(uint256 secondsPassed) external {
        // Calculate yield for time period
        // APY to per-second rate: apyBps / 10000 / 365.25 / 24 / 60 / 60
        uint256 ratePerSecond = (apyBps * 1e18) / 10000 / 31557600; // 365.25 days

        // New exchange rate = old * (1 + rate * seconds)
        uint256 oldRate = aToken.exchangeRate();
        uint256 yieldMultiplier = 1e18 + (ratePerSecond * secondsPassed);
        uint256 newRate = (oldRate * yieldMultiplier) / 1e18;

        aToken.setExchangeRate(newRate);
        lastAccrualTime = block.timestamp;

        uint256 yieldAmount = ((newRate - oldRate) * aToken.totalSupply()) / 1e18;
        emit YieldAccrued(oldRate, newRate, yieldAmount);
    }

    /**
     * @notice Set APY for testing
     * @param _apyBps New APY in basis points
     */
    function setAPY(uint256 _apyBps) external {
        apyBps = _apyBps;
    }

    // ============ View Functions ============

    /**
     * @notice Get user's underlying balance
     * @param user User address
     * @return Underlying USDC value
     */
    function getUserUnderlyingBalance(address user) external view returns (uint256) {
        uint256 aTokenBalance = aToken.balanceOf(user);
        return (aTokenBalance * aToken.exchangeRate()) / 1e18;
    }

    /**
     * @notice Get reserve data (simplified)
     * @param asset Asset address
     */
    function getReserveData(address asset) external view returns (
        uint256 liquidityRate,
        uint256 variableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex
    ) {
        require(asset == address(usdc), "Only USDC");
        return (
            apyBps * 1e23, // Convert to ray (1e27)
            0,
            aToken.exchangeRate() * 1e9, // Scale to ray
            1e27
        );
    }

    /**
     * @notice Get aToken address for asset
     */
    function getReserveAToken(address asset) external view returns (address) {
        require(asset == address(usdc), "Only USDC");
        return address(aToken);
    }

    /**
     * @notice Get current exchange rate
     */
    function getExchangeRate() external view returns (uint256) {
        return aToken.exchangeRate();
    }

    /**
     * @notice Get pool USDC balance
     */
    function getPoolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ============ Internal Functions ============

    function _accrueYield() internal {
        if (block.timestamp <= lastAccrualTime) return;

        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        uint256 ratePerSecond = (apyBps * 1e18) / 10000 / 31557600;

        uint256 oldRate = aToken.exchangeRate();
        uint256 yieldMultiplier = 1e18 + (ratePerSecond * timeElapsed);
        uint256 newRate = (oldRate * yieldMultiplier) / 1e18;

        aToken.setExchangeRate(newRate);
        lastAccrualTime = block.timestamp;
    }

    // ============ Funding Functions ============

    /**
     * @notice Fund pool with USDC (for testing withdrawals)
     */
    function fundPool(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }
}
