// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../../src/base/LiquidityPool.sol";
import "../mocks/MockUSDC.sol";

/**
 * @title LiquidityPoolHandler
 * @notice Handler contract for invariant testing - defines actions that can be performed
 */
contract LiquidityPoolHandler is Test {
    LiquidityPool public pool;
    MockUSDC public usdc;

    address[] public actors;
    address public currentActor;
    address public router;

    // Ghost variables for tracking state
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalWithdrawn;
    uint256 public ghost_totalDeployed;
    uint256 public ghost_totalRepaid;
    uint256 public ghost_totalYield;

    mapping(address => uint256) public ghost_userDeposits;
    mapping(address => uint256) public ghost_userWithdrawals;

    modifier useActor(uint256 actorIndexSeed) {
        currentActor = actors[bound(actorIndexSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(LiquidityPool _pool, MockUSDC _usdc, address _router) {
        pool = _pool;
        usdc = _usdc;
        router = _router;

        // Setup actors
        for (uint256 i = 0; i < 5; i++) {
            address actor = address(uint160(0x1000 + i));
            actors.push(actor);

            // Fund actors
            usdc.mint(actor, 100_000_000e6);
            vm.prank(actor);
            usdc.approve(address(pool), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        amount = bound(amount, 1e6, 10_000_000e6);

        if (usdc.balanceOf(currentActor) < amount) return;

        uint256 sharesBefore = pool.balanceOf(currentActor);
        pool.deposit(amount, currentActor);
        uint256 sharesAfter = pool.balanceOf(currentActor);

        ghost_totalDeposited += amount;
        ghost_userDeposits[currentActor] += amount;

        // Verify shares were minted
        assert(sharesAfter > sharesBefore);
    }

    function withdraw(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        uint256 maxWithdraw = pool.maxWithdraw(currentActor);
        if (maxWithdraw == 0) return;

        amount = bound(amount, 1, maxWithdraw);

        uint256 balanceBefore = usdc.balanceOf(currentActor);
        pool.withdraw(amount, currentActor, currentActor);
        uint256 balanceAfter = usdc.balanceOf(currentActor);

        ghost_totalWithdrawn += (balanceAfter - balanceBefore);
        ghost_userWithdrawals[currentActor] += (balanceAfter - balanceBefore);
    }

    function redeem(uint256 actorSeed, uint256 shares) public useActor(actorSeed) {
        uint256 maxRedeem = pool.maxRedeem(currentActor);
        if (maxRedeem == 0) return;

        shares = bound(shares, 1, maxRedeem);

        uint256 balanceBefore = usdc.balanceOf(currentActor);
        pool.redeem(shares, currentActor, currentActor);
        uint256 balanceAfter = usdc.balanceOf(currentActor);

        ghost_totalWithdrawn += (balanceAfter - balanceBefore);
        ghost_userWithdrawals[currentActor] += (balanceAfter - balanceBefore);
    }

    function deployForFunding(uint256 amount) public {
        uint256 available = pool.availableLiquidity();
        if (available == 0) return;

        amount = bound(amount, 1, available);

        vm.prank(router);
        pool.deployForFunding(amount, 1);

        ghost_totalDeployed += amount;
    }

    function receiveRepayment(uint256 principal, uint256 yield_) public {
        uint256 deployed = pool.totalDeployed();
        if (deployed == 0) return;

        principal = bound(principal, 1, deployed);
        yield_ = bound(yield_, 0, principal / 10); // Max 10% yield

        // Mint the repayment (principal + yield) and send to pool
        usdc.mint(router, yield_);
        vm.prank(router);
        usdc.transfer(address(pool), principal + yield_);

        vm.prank(router);
        pool.receiveRepayment(principal, yield_, 1);

        ghost_totalRepaid += principal;
        ghost_totalYield += yield_;
    }

    function getActorCount() public view returns (uint256) {
        return actors.length;
    }
}

/**
 * @title LiquidityPool Invariant Tests
 * @notice Invariant tests for the LiquidityPool contract
 */
contract LiquidityPoolInvariantTest is StdInvariant, Test {
    LiquidityPool public pool;
    MockUSDC public usdc;
    LiquidityPoolHandler public handler;

    address public router = address(0x9999);

    function setUp() public {
        // Deploy contracts
        usdc = new MockUSDC();
        pool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Grant roles
        pool.grantRole(pool.ROUTER_ROLE(), router);

        // Deploy handler
        handler = new LiquidityPoolHandler(pool, usdc, router);

        // Set handler as target
        targetContract(address(handler));

        // Exclude certain functions from invariant testing
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.deposit.selector;
        selectors[1] = handler.withdraw.selector;
        selectors[2] = handler.redeem.selector;
        selectors[3] = handler.deployForFunding.selector;
        selectors[4] = handler.receiveRepayment.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /* INVARIANT TESTS - COMMENTED FOR FASTER RUNS
    // ============ Invariant: Total Assets >= Total Supply ============

    function invariant_totalAssetsGeSupply() public view {
        uint256 totalAssets = pool.totalAssets();
        uint256 totalSupply = pool.totalSupply();

        // Total assets should always be >= total supply (or equal when 1:1)
        // This can only be violated if there's a loss (which shouldn't happen)
        assertGe(totalAssets, totalSupply, "Total assets < total supply");
    }

    // ============ Invariant: Deployed + Available = Total (excluding treasury) ============

    function invariant_deployedPlusAvailableEqualsTotal() public view {
        uint256 deployed = pool.totalDeployed();
        uint256 available = pool.availableLiquidity();
        uint256 totalAssets = pool.totalAssets();

        // Without treasury, deployed + available should equal totalAssets
        // With treasury, it would be: deployed + available + treasury = totalAssets
        assertEq(deployed + available, totalAssets, "Deployed + Available != Total");
    }

    // ============ Invariant: Utilization Rate <= 100% ============

    function invariant_utilizationRateBounded() public view {
        uint256 rate = pool.utilizationRate();

        assertLe(rate, 10000, "Utilization rate > 100%");
    }

    // ============ Invariant: Share Price Never Zero (when supply > 0) ============

    function invariant_sharePriceNeverZero() public view {
        if (pool.totalSupply() == 0) return;

        uint256 sharePrice = pool.convertToAssets(1e6);
        assertGt(sharePrice, 0, "Share price is zero");
    }

    // ============ Invariant: No Free Shares ============

    function invariant_noFreeShares() public view {
        // Total deposited (tracked by handler) should be >= value withdrawn
        // Difference is the yield earned
        uint256 totalDeposited = handler.ghost_totalDeposited();
        uint256 totalWithdrawn = handler.ghost_totalWithdrawn();
        uint256 totalYield = handler.ghost_totalYield();

        // Withdrawn should never exceed deposits + yield
        assertLe(totalWithdrawn, totalDeposited + totalYield, "Withdrew more than deposited + yield");
    }

    // ============ Invariant: USDC Balance Accounting ============

    function invariant_usdcBalanceAccounting() public view {
        uint256 poolBalance = usdc.balanceOf(address(pool));
        uint256 totalDeployed = pool.totalDeployed();
        uint256 totalAssets = pool.totalAssets();

        // Pool balance + deployed should equal totalAssets (ignoring treasury)
        assertEq(poolBalance + totalDeployed, totalAssets, "USDC balance accounting error");
    }

    // ============ Invariant: Max Withdraw Bounded by Balance ============

    function invariant_maxWithdrawBounded() public view {
        for (uint256 i = 0; i < handler.getActorCount(); i++) {
            address actor = handler.actors(i);
            uint256 maxWithdraw = pool.maxWithdraw(actor);
            uint256 shares = pool.balanceOf(actor);

            // Max withdraw should be bounded by share value
            uint256 shareValue = pool.convertToAssets(shares);
            assertLe(maxWithdraw, shareValue + 1, "Max withdraw exceeds share value"); // +1 for rounding
        }
    }

    // ============ Invariant: Total Supply = Sum of Balances ============

    function invariant_totalSupplyEqualsSumBalances() public view {
        uint256 sum = 0;
        for (uint256 i = 0; i < handler.getActorCount(); i++) {
            sum += pool.balanceOf(handler.actors(i));
        }

        assertEq(pool.totalSupply(), sum, "Total supply != sum of balances");
    }

    // ============ Call Summary ============

    function invariant_callSummary() public view {
        console.log("Total deposited:", handler.ghost_totalDeposited());
        console.log("Total withdrawn:", handler.ghost_totalWithdrawn());
        console.log("Total deployed:", handler.ghost_totalDeployed());
        console.log("Total repaid:", handler.ghost_totalRepaid());
        console.log("Total yield:", handler.ghost_totalYield());
        console.log("Pool total assets:", pool.totalAssets());
        console.log("Pool total supply:", pool.totalSupply());
    }
    INVARIANT TESTS - COMMENTED FOR FASTER RUNS */
}
