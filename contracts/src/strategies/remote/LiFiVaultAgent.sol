// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../../interfaces/ILiFiDiamond.sol";

/**
 * @title IAavePool
 * @notice Interface for Aave V3 Pool
 */
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

/**
 * @title IAToken
 * @notice Interface for Aave aToken
 */
interface IAToken {
    function balanceOf(address account) external view returns (uint256);
    function scaledBalanceOf(address user) external view returns (uint256);
}

/**
 * @title LiFiVaultAgent
 * @notice Remote agent on Arbitrum that manages Aave V3 deposits
 * @dev Deployed on Arbitrum, receives USDC via LI.FI, deposits to Aave V3
 *
 * Flow:
 * 1. LI.FI bridge delivers USDC to this contract
 * 2. Keeper calls processDeposit() to deposit into Aave
 * 3. On withdrawal request, keeper calls initiateWithdrawal()
 * 4. Agent withdraws from Aave and bridges back via LI.FI
 *
 * Addresses (Arbitrum):
 * - USDC: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 * - Aave V3 Pool: 0x794a61358D6845594F94dc1DB02A252b5b4814aD
 * - aUSDC: 0x724dc807b04555b71ed48a6896b6F41593b8C637
 * - LI.FI Diamond: 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE
 */
contract LiFiVaultAgent is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Base chain ID
    uint256 public constant BASE_CHAIN_ID = 8453;

    /// @notice Aave V3 Pool on Arbitrum
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

    /// @notice USDC on Arbitrum
    address public constant USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    /// @notice aUSDC on Arbitrum
    address public constant AUSDC_ARBITRUM = 0x724dc807b04555b71ed48a6896b6F41593b8C637;

    /// @notice LI.FI Diamond on Arbitrum
    address public constant LIFI_DIAMOND = 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    // ============ State Variables ============

    /// @notice USDC token
    IERC20 public usdc;

    /// @notice aUSDC token
    IAToken public aToken;

    /// @notice Aave Pool
    IAavePool public aavePool;

    /// @notice LI.FI Diamond
    ILiFiDiamond public lifiDiamond;

    /// @notice Strategy contract on Base
    address public homeStrategy;

    /// @notice Authorized keepers
    mapping(address => bool) public keepers;

    /// @notice Bridge to use for return transfers
    string public bridge = "stargate";

    /// @notice Total deposited into Aave
    uint256 public totalDeposited;

    /// @notice Transfer counter
    uint256 internal _transferCounter;

    // ============ Events ============

    event DepositProcessed(bytes32 indexed transferId, uint256 amount, uint256 aTokensReceived);
    event WithdrawalInitiated(bytes32 indexed transferId, uint256 amount);
    event WithdrawalCompleted(bytes32 indexed transferId, uint256 amountBridged);
    event ValueReported(uint256 value, uint256 timestamp);
    event KeeperUpdated(address indexed keeper, bool authorized);
    event HomeStrategyUpdated(address oldStrategy, address newStrategy);
    event BridgeUpdated(string oldBridge, string newBridge);

    // ============ Errors ============

    error OnlyKeeper();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error BridgeFailed();

    // ============ Modifiers ============

    modifier onlyKeeper() {
        if (!keepers[msg.sender]) revert OnlyKeeper();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the agent
     * @param _homeStrategy LiFiVaultStrategy address on Base
     * @param _usdc USDC address (use default if zero)
     * @param _aavePool Aave Pool address (use default if zero)
     * @param _lifiDiamond LI.FI Diamond address (use default if zero)
     */
    constructor(
        address _homeStrategy,
        address _usdc,
        address _aavePool,
        address _lifiDiamond
    ) Ownable(msg.sender) {
        if (_homeStrategy == address(0)) revert ZeroAddress();

        homeStrategy = _homeStrategy;

        usdc = IERC20(_usdc != address(0) ? _usdc : USDC_ARBITRUM);
        aavePool = IAavePool(_aavePool != address(0) ? _aavePool : AAVE_POOL);
        aToken = IAToken(AUSDC_ARBITRUM);
        lifiDiamond = ILiFiDiamond(_lifiDiamond != address(0) ? _lifiDiamond : LIFI_DIAMOND);

        // Owner is keeper by default
        keepers[msg.sender] = true;

        // Approve Aave to spend USDC
        usdc.approve(address(aavePool), type(uint256).max);

        // Approve LI.FI to spend USDC
        usdc.approve(address(lifiDiamond), type(uint256).max);
    }

    // ============ Deposit Functions ============

    /**
     * @notice Process incoming deposit (deposit to Aave)
     * @param transferId Bridge transfer identifier
     * @dev Called by keeper after LI.FI delivers USDC
     */
    function processDeposit(bytes32 transferId) external onlyKeeper nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        uint256 aTokensBefore = aToken.balanceOf(address(this));

        // Deposit to Aave
        aavePool.supply(address(usdc), balance, address(this), 0);

        uint256 aTokensAfter = aToken.balanceOf(address(this));
        uint256 aTokensReceived = aTokensAfter - aTokensBefore;

        totalDeposited += balance;

        emit DepositProcessed(transferId, balance, aTokensReceived);
    }

    /**
     * @notice Auto-deposit any USDC received
     * @dev Convenience function to deposit all USDC without transfer ID
     */
    function autoDeposit() external onlyKeeper nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        aavePool.supply(address(usdc), balance, address(this), 0);
        totalDeposited += balance;

        bytes32 autoId = keccak256(abi.encodePacked("auto", block.timestamp, balance));
        emit DepositProcessed(autoId, balance, balance);
    }

    // ============ Withdrawal Functions ============

    /**
     * @notice Initiate withdrawal from Aave and bridge back to Base
     * @param transferId Withdrawal transfer identifier from home strategy
     * @param amount Amount to withdraw
     */
    function initiateWithdrawal(bytes32 transferId, uint256 amount) external onlyKeeper nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Get current value
        uint256 currentValue = getCurrentValue();
        if (amount > currentValue) {
            amount = currentValue; // Withdraw max available
        }

        emit WithdrawalInitiated(transferId, amount);

        // Withdraw from Aave
        uint256 withdrawn = aavePool.withdraw(address(usdc), amount, address(this));

        if (withdrawn >= totalDeposited) {
            totalDeposited = 0;
        } else {
            totalDeposited -= withdrawn;
        }

        // Bridge back to Base
        bytes32 bridgeId = _bridgeToBase(withdrawn);

        emit WithdrawalCompleted(transferId, withdrawn);
    }

    /**
     * @notice Withdraw all from Aave and bridge back
     */
    function withdrawAll() external onlyKeeper nonReentrant {
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        if (aTokenBalance == 0) revert ZeroAmount();

        // Withdraw all from Aave
        uint256 withdrawn = aavePool.withdraw(address(usdc), type(uint256).max, address(this));

        totalDeposited = 0;

        bytes32 transferId = _generateTransferId();
        emit WithdrawalInitiated(transferId, withdrawn);

        // Bridge back
        _bridgeToBase(withdrawn);

        emit WithdrawalCompleted(transferId, withdrawn);
    }

    // ============ Value Reporting ============

    /**
     * @notice Get current value in USDC terms
     * @return Current value of aUSDC holdings
     */
    function getCurrentValue() public view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    /**
     * @notice Report current value (for keeper to relay to home strategy)
     * @dev Emits event that keeper picks up
     */
    function reportValue() external onlyKeeper {
        uint256 value = getCurrentValue();
        emit ValueReported(value, block.timestamp);
    }

    /**
     * @notice Get detailed position info
     */
    function getPosition() external view returns (
        uint256 aTokenBalance,
        uint256 usdcBalance,
        uint256 totalValue,
        uint256 yieldEarned
    ) {
        aTokenBalance = aToken.balanceOf(address(this));
        usdcBalance = usdc.balanceOf(address(this));
        totalValue = aTokenBalance + usdcBalance;
        yieldEarned = totalValue > totalDeposited ? totalValue - totalDeposited : 0;
    }

    // ============ Internal Functions ============

    /**
     * @notice Bridge USDC back to Base
     * @param amount Amount to bridge
     * @return transferId Bridge transfer identifier
     */
    function _bridgeToBase(uint256 amount) internal returns (bytes32 transferId) {
        transferId = _generateTransferId();

        ILiFiDiamond.BridgeData memory bridgeData = ILiFiDiamond.BridgeData({
            transactionId: transferId,
            bridge: bridge,
            integrator: "seed-finance",
            referrer: address(0),
            sendingAssetId: address(usdc),
            receiver: homeStrategy,
            minAmount: amount,
            destinationChainId: BASE_CHAIN_ID,
            hasSourceSwaps: false,
            hasDestinationCall: false
        });

        try lifiDiamond.startBridgeTokensViaBridge(bridgeData) {
            // Success
        } catch {
            revert BridgeFailed();
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
     * @notice Update bridge
     */
    function setBridge(string calldata newBridge) external onlyOwner {
        string memory oldBridge = bridge;
        bridge = newBridge;
        emit BridgeUpdated(oldBridge, newBridge);
    }

    /**
     * @notice Emergency withdraw to owner
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        // Withdraw from Aave
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        if (aTokenBalance > 0) {
            aavePool.withdraw(address(usdc), type(uint256).max, owner());
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
        require(token != address(usdc) && token != address(aToken), "Cannot rescue core tokens");
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
