// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "src/interfaces/ITreasuryStrategy.sol";

/**
 * @title MockStrategy
 * @notice Mock treasury strategy for testing
 * @dev Simulates a yield strategy with configurable APY
 */
contract MockStrategy is ITreasuryStrategy {
    using SafeERC20 for IERC20;

    string public constant override name = "Mock Strategy";

    IERC20 public immutable _asset;
    address public treasuryManager;
    bool public override isActive = true;
    uint256 public override estimatedAPY = 500; // 5%

    uint256 public totalDeposited;
    uint256 public simulatedYield;

    constructor(address asset_, address treasuryManager_) {
        _asset = IERC20(asset_);
        treasuryManager = treasuryManager_;
    }

    function deposit(uint256 amount) external override returns (uint256) {
        require(msg.sender == treasuryManager, "Only manager");
        require(isActive, "Not active");

        // TreasuryManager uses push pattern: funds are transferred BEFORE calling deposit()
        // So we just record the deposit, no need to pull
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, amount);
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256) {
        require(msg.sender == treasuryManager, "Only manager");

        uint256 toWithdraw = amount > totalValue() ? totalValue() : amount;
        totalDeposited = totalDeposited > toWithdraw ? totalDeposited - toWithdraw : 0;

        _asset.safeTransfer(msg.sender, toWithdraw);

        emit Withdrawn(msg.sender, amount, toWithdraw);
        return toWithdraw;
    }

    function withdrawAll() external override returns (uint256) {
        require(msg.sender == treasuryManager, "Only manager");

        uint256 balance = _asset.balanceOf(address(this));
        totalDeposited = 0;

        if (balance > 0) {
            _asset.safeTransfer(msg.sender, balance);
        }

        emit Withdrawn(msg.sender, balance, balance);
        return balance;
    }

    function totalValue() public view override returns (uint256) {
        // Just return the actual balance - simulatedYield is only used
        // when we don't mint actual tokens (for pure simulation)
        // If minting real tokens for yield, just use balance
        return _asset.balanceOf(address(this));
    }

    function asset() external view override returns (address) {
        return address(_asset);
    }

    function supportsInstantWithdraw() external pure override returns (bool) {
        return true;
    }

    function maxInstantWithdraw() external view override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    // ============ Test Helpers ============

    function setActive(bool _active) external {
        isActive = _active;
        emit StrategyStatusChanged(_active);
    }

    function setAPY(uint256 _apy) external {
        estimatedAPY = _apy;
    }

    function addSimulatedYield(uint256 amount) external {
        simulatedYield += amount;
    }

    function setTreasuryManager(address _manager) external {
        treasuryManager = _manager;
    }

    /**
     * @notice Simulate yield by minting additional tokens
     * @param yieldBps Yield in basis points (e.g., 5000 = 50%)
     */
    function simulateYield(uint256 yieldBps) external {
        uint256 currentBalance = _asset.balanceOf(address(this));
        uint256 yieldAmount = (currentBalance * yieldBps) / 10000;

        // We need to mint directly - cast to MockUSDC
        // This is a test helper
        (bool success, ) = address(_asset).call(
            abi.encodeWithSignature("mint(address,uint256)", address(this), yieldAmount)
        );
        require(success, "Yield simulation failed");
    }

    /**
     * @notice Simulate loss by burning tokens
     * @param lossBps Loss in basis points (e.g., 5000 = 50%)
     */
    function simulateLoss(uint256 lossBps) external {
        uint256 currentBalance = _asset.balanceOf(address(this));
        uint256 lossAmount = (currentBalance * lossBps) / 10000;

        // Transfer to zero address to simulate loss (or to a burn address)
        // Actually just transfer out to simulate loss
        _asset.safeTransfer(address(0xdead), lossAmount);
        totalDeposited = totalDeposited > lossAmount ? totalDeposited - lossAmount : 0;
    }
}
