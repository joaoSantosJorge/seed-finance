// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockUSYCArc
 * @notice Mock USYC token for Arc chain testing
 * @dev Simulates Hashnote USYC (US Treasury yield) on Arc chain
 *
 * Real USYC on Arc: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
 *
 * USYC is an ERC-4626 vault backed by US Treasury Bills
 * - Daily yield accrual
 * - ~4.5% APY
 */
contract MockUSYCArc is ERC20 {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice Underlying asset (USDC)
    IERC20 public immutable usdc;

    /// @notice Exchange rate (scaled by 1e18, starts at 1:1)
    uint256 public exchangeRate = 1e18;

    /// @notice APY in basis points (default 4.5%)
    uint256 public apyBps = 450;

    /// @notice Last yield accrual timestamp
    uint256 public lastAccrualTime;

    /// @notice Total assets deposited
    uint256 public _totalAssets;

    // ============ Events ============

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event YieldAccrued(uint256 oldRate, uint256 newRate);

    // ============ Constructor ============

    constructor(address _usdc) ERC20("Hashnote USYC (Arc)", "USYC") {
        usdc = IERC20(_usdc);
        lastAccrualTime = block.timestamp;
    }

    // ============ ERC-4626 Functions ============

    /**
     * @notice Get underlying asset
     */
    function asset() external view returns (address) {
        return address(usdc);
    }

    /**
     * @notice Get total assets under management
     */
    function totalAssets() external view returns (uint256) {
        return _totalAssets;
    }

    /**
     * @notice Convert assets to shares
     * @param assets Amount of USDC
     * @return shares Amount of USYC shares
     */
    function convertToShares(uint256 assets) public view returns (uint256 shares) {
        return (assets * 1e18) / exchangeRate;
    }

    /**
     * @notice Convert shares to assets
     * @param shares Amount of USYC shares
     * @return assets Amount of USDC
     */
    function convertToAssets(uint256 shares) public view returns (uint256 assets) {
        return (shares * exchangeRate) / 1e18;
    }

    /**
     * @notice Preview deposit
     * @param assets Amount of USDC
     * @return shares Expected USYC shares
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares) {
        return convertToShares(assets);
    }

    /**
     * @notice Preview redeem
     * @param shares Amount of USYC shares
     * @return assets Expected USDC
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets) {
        return convertToAssets(shares);
    }

    /**
     * @notice Deposit USDC and receive USYC shares
     * @param assets Amount of USDC to deposit
     * @param receiver Address to receive shares
     * @return shares Amount of USYC shares minted
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets > 0, "Zero assets");

        // Accrue yield first
        _accrueYield();

        // Calculate shares
        shares = convertToShares(assets);

        // Transfer USDC from sender
        usdc.safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares
        _mint(receiver, shares);

        _totalAssets += assets;

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /**
     * @notice Redeem USYC shares for USDC
     * @param shares Amount of shares to redeem
     * @param receiver Address to receive USDC
     * @param owner Owner of the shares
     * @return assets Amount of USDC received
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        require(shares > 0, "Zero shares");
        require(balanceOf(owner) >= shares, "Insufficient shares");

        // Accrue yield first
        _accrueYield();

        // Calculate assets
        assets = convertToAssets(shares);

        // Handle allowance if caller is not owner
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        // Burn shares
        _burn(owner, shares);

        // Transfer USDC
        usdc.safeTransfer(receiver, assets);

        if (assets >= _totalAssets) {
            _totalAssets = 0;
        } else {
            _totalAssets -= assets;
        }

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    /**
     * @notice Withdraw specific amount of USDC
     * @param assets Amount of USDC to withdraw
     * @param receiver Address to receive USDC
     * @param owner Owner of the shares
     * @return shares Amount of shares burned
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        require(assets > 0, "Zero assets");

        // Accrue yield first
        _accrueYield();

        // Calculate shares needed
        shares = convertToShares(assets);
        require(balanceOf(owner) >= shares, "Insufficient shares");

        // Handle allowance
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        // Burn shares
        _burn(owner, shares);

        // Transfer USDC
        usdc.safeTransfer(receiver, assets);

        if (assets >= _totalAssets) {
            _totalAssets = 0;
        } else {
            _totalAssets -= assets;
        }

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    // ============ Yield Functions ============

    /**
     * @notice Accrue yield based on time passed
     */
    function accrueYield() external {
        _accrueYield();
    }

    /**
     * @notice Simulate time passage with yield accrual
     * @param secondsPassed Seconds to simulate
     */
    function simulateTimePassage(uint256 secondsPassed) external {
        uint256 ratePerSecond = (apyBps * 1e18) / 10000 / 31557600;

        uint256 oldRate = exchangeRate;
        uint256 yieldMultiplier = 1e18 + (ratePerSecond * secondsPassed);
        exchangeRate = (oldRate * yieldMultiplier) / 1e18;

        // Update total assets to reflect yield
        _totalAssets = convertToAssets(totalSupply());

        lastAccrualTime = block.timestamp;

        emit YieldAccrued(oldRate, exchangeRate);
    }

    /**
     * @notice Set APY for testing
     */
    function setAPY(uint256 _apyBps) external {
        apyBps = _apyBps;
    }

    /**
     * @notice Set exchange rate directly (for testing)
     */
    function setExchangeRate(uint256 newRate) external {
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        emit YieldAccrued(oldRate, newRate);
    }

    // ============ View Functions ============

    /**
     * @notice Get max deposit
     */
    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @notice Get max redeem
     */
    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    /**
     * @notice Override decimals to match USDC
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // ============ Internal Functions ============

    function _accrueYield() internal {
        if (block.timestamp <= lastAccrualTime) return;

        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        uint256 ratePerSecond = (apyBps * 1e18) / 10000 / 31557600;

        uint256 oldRate = exchangeRate;
        uint256 yieldMultiplier = 1e18 + (ratePerSecond * timeElapsed);
        exchangeRate = (oldRate * yieldMultiplier) / 1e18;

        // Update total assets
        _totalAssets = convertToAssets(totalSupply());

        lastAccrualTime = block.timestamp;

        emit YieldAccrued(oldRate, exchangeRate);
    }

    // ============ Funding Functions ============

    /**
     * @notice Fund contract with USDC (for testing redemptions)
     */
    function fundVault(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }
}
