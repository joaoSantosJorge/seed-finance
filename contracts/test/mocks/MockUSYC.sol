// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSYC
 * @notice Mock USYC token for testing treasury strategies
 * @dev Simulates USYC's ERC-4626-like interface with configurable yield
 */
contract MockUSYC is ERC20 {
    IERC20 public immutable usdc;

    // Configurable exchange rate (basis points over 1:1)
    // 10000 = 1:1, 10100 = 1% yield
    uint256 public exchangeRateBps = 10000;

    constructor(address _usdc) ERC20("Mock USYC", "mUSYC") {
        usdc = IERC20(_usdc);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        // Pull USDC
        usdc.transferFrom(msg.sender, address(this), assets);

        // Mint USYC shares (1:1 on deposit)
        shares = assets;
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner_) external returns (uint256 assets) {
        require(owner_ == msg.sender, "Not owner");

        // Burn shares
        _burn(msg.sender, shares);

        // Return USDC with yield applied
        assets = convertToAssets(shares);
        usdc.transfer(receiver, assets);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return (shares * exchangeRateBps) / 10000;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return (assets * 10000) / exchangeRateBps;
    }

    function totalAssets() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ============ Test Helpers ============

    function setExchangeRate(uint256 _bps) external {
        exchangeRateBps = _bps;
    }

    function simulateYield(uint256 yieldBps) external {
        exchangeRateBps = 10000 + yieldBps;
    }
}
