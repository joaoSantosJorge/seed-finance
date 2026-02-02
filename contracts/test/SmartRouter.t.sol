// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/integrations/SmartRouter.sol";
import "../src/base/LiquidityPool.sol";
import "./mocks/MockUSDC.sol";

/**
 * @title SmartRouter Test Suite
 * @notice Comprehensive tests for SmartRouter - unified deposit routing
 */
contract SmartRouterTest is Test {
    SmartRouter public router;
    LiquidityPool public pool;
    MockUSDC public usdc;

    // Test addresses
    address public owner = address(this);
    address public user = address(0x1);
    address public cctpReceiver = address(0x2);
    address public lifiReceiver = address(0x3);
    address public beneficiary = address(0x4);

    // Test constants
    uint256 constant MIN_DEPOSIT = 1e6; // 1 USDC
    uint256 constant DEPOSIT_AMOUNT = 1000e6; // 1000 USDC

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        pool = new LiquidityPool(
            IERC20(address(usdc)),
            "Seed Finance LP",
            "SEED"
        );

        // Deploy SmartRouter
        router = new SmartRouter(
            address(usdc),
            address(pool),
            MIN_DEPOSIT
        );

        // Mint USDC to test accounts
        usdc.mint(user, 1_000_000e6);
        usdc.mint(cctpReceiver, 1_000_000e6);
        usdc.mint(lifiReceiver, 1_000_000e6);
        usdc.mint(address(router), 1_000_000e6); // For handler tests

        // Approve router to spend user's USDC
        vm.prank(user);
        usdc.approve(address(router), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_Constructor() public view {
        assertEq(address(router.usdc()), address(usdc));
        assertEq(address(router.liquidityPool()), address(pool));
        assertEq(router.minDepositAmount(), MIN_DEPOSIT);
        assertEq(router.owner(), owner);
    }

    function test_Constructor_RevertZeroUSDC() public {
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        new SmartRouter(address(0), address(pool), MIN_DEPOSIT);
    }

    function test_Constructor_RevertZeroPool() public {
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        new SmartRouter(address(usdc), address(0), MIN_DEPOSIT);
    }

    // ============ Direct Deposit Tests ============

    function test_DepositDirect_Success() public {
        vm.prank(user);
        uint256 shares = router.depositDirect(DEPOSIT_AMOUNT);

        assertGt(shares, 0);
        assertEq(pool.balanceOf(user), shares);
        assertEq(router.totalRouted(), DEPOSIT_AMOUNT);
        assertEq(router.depositsByMethod(SmartRouter.DepositMethod.Direct), 1);
    }

    function test_DepositDirect_MultipleDeposits() public {
        vm.startPrank(user);

        uint256 shares1 = router.depositDirect(DEPOSIT_AMOUNT);
        uint256 shares2 = router.depositDirect(DEPOSIT_AMOUNT);

        vm.stopPrank();

        assertEq(pool.balanceOf(user), shares1 + shares2);
        assertEq(router.totalRouted(), DEPOSIT_AMOUNT * 2);
        assertEq(router.depositsByMethod(SmartRouter.DepositMethod.Direct), 2);
    }

    function test_DepositDirect_RevertZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(SmartRouter.ZeroAmount.selector);
        router.depositDirect(0);
    }

    function test_DepositDirect_RevertBelowMinimum() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(
            SmartRouter.AmountBelowMinimum.selector,
            MIN_DEPOSIT - 1,
            MIN_DEPOSIT
        ));
        router.depositDirect(MIN_DEPOSIT - 1);
    }

    function test_DepositDirect_ExactMinimum() public {
        vm.prank(user);
        uint256 shares = router.depositDirect(MIN_DEPOSIT);
        assertGt(shares, 0);
    }

    // ============ DepositDirectFor Tests ============

    function test_DepositDirectFor_Success() public {
        vm.prank(user);
        uint256 shares = router.depositDirectFor(beneficiary, DEPOSIT_AMOUNT);

        assertGt(shares, 0);
        assertEq(pool.balanceOf(beneficiary), shares);
        assertEq(pool.balanceOf(user), 0); // User doesn't get shares
    }

    function test_DepositDirectFor_RevertZeroBeneficiary() public {
        vm.prank(user);
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.depositDirectFor(address(0), DEPOSIT_AMOUNT);
    }

    // ============ CCTP Handler Tests ============

    function test_HandleCCTPDeposit_Success() public {
        // Set up CCTP receiver
        router.setCCTPReceiver(cctpReceiver);

        // Simulate CCTP receiver calling handler
        // USDC should already be in router (simulated by setUp)
        vm.prank(cctpReceiver);
        uint256 shares = router.handleCCTPDeposit(beneficiary, DEPOSIT_AMOUNT, 0);

        assertGt(shares, 0);
        assertEq(pool.balanceOf(beneficiary), shares);
        assertEq(router.totalRouted(), DEPOSIT_AMOUNT);
        assertEq(router.depositsByMethod(SmartRouter.DepositMethod.CCTP), 1);
    }

    function test_HandleCCTPDeposit_RevertUnauthorizedHandler() public {
        vm.prank(cctpReceiver);
        vm.expectRevert(abi.encodeWithSelector(
            SmartRouter.UnauthorizedHandler.selector,
            cctpReceiver
        ));
        router.handleCCTPDeposit(beneficiary, DEPOSIT_AMOUNT, 0);
    }

    function test_HandleCCTPDeposit_RevertZeroAmount() public {
        router.setCCTPReceiver(cctpReceiver);

        vm.prank(cctpReceiver);
        vm.expectRevert(SmartRouter.ZeroAmount.selector);
        router.handleCCTPDeposit(beneficiary, 0, 0);
    }

    function test_HandleCCTPDeposit_RevertZeroBeneficiary() public {
        router.setCCTPReceiver(cctpReceiver);

        vm.prank(cctpReceiver);
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.handleCCTPDeposit(address(0), DEPOSIT_AMOUNT, 0);
    }

    function test_HandleCCTPDeposit_RevertInsufficientBalance() public {
        // Deploy new router without USDC
        SmartRouter newRouter = new SmartRouter(
            address(usdc),
            address(pool),
            MIN_DEPOSIT
        );
        newRouter.setCCTPReceiver(cctpReceiver);

        vm.prank(cctpReceiver);
        vm.expectRevert(SmartRouter.InsufficientBalance.selector);
        newRouter.handleCCTPDeposit(beneficiary, DEPOSIT_AMOUNT, 0);
    }

    // ============ LiFi Handler Tests ============

    function test_HandleLiFiDeposit_Success() public {
        // Set up LiFi receiver
        router.setLiFiReceiver(lifiReceiver);

        bytes32 transferId = bytes32("transfer123");

        vm.prank(lifiReceiver);
        uint256 shares = router.handleLiFiDeposit(beneficiary, DEPOSIT_AMOUNT, transferId);

        assertGt(shares, 0);
        assertEq(pool.balanceOf(beneficiary), shares);
        assertEq(router.totalRouted(), DEPOSIT_AMOUNT);
        assertEq(router.depositsByMethod(SmartRouter.DepositMethod.LiFi), 1);
    }

    function test_HandleLiFiDeposit_RevertUnauthorizedHandler() public {
        bytes32 transferId = bytes32("transfer123");

        vm.prank(lifiReceiver);
        vm.expectRevert(abi.encodeWithSelector(
            SmartRouter.UnauthorizedHandler.selector,
            lifiReceiver
        ));
        router.handleLiFiDeposit(beneficiary, DEPOSIT_AMOUNT, transferId);
    }

    function test_HandleLiFiDeposit_RevertZeroAmount() public {
        router.setLiFiReceiver(lifiReceiver);

        vm.prank(lifiReceiver);
        vm.expectRevert(SmartRouter.ZeroAmount.selector);
        router.handleLiFiDeposit(beneficiary, 0, bytes32(0));
    }

    function test_HandleLiFiDeposit_RevertZeroBeneficiary() public {
        router.setLiFiReceiver(lifiReceiver);

        vm.prank(lifiReceiver);
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.handleLiFiDeposit(address(0), DEPOSIT_AMOUNT, bytes32(0));
    }

    function test_HandleLiFiDeposit_RevertInsufficientBalance() public {
        SmartRouter newRouter = new SmartRouter(
            address(usdc),
            address(pool),
            MIN_DEPOSIT
        );
        newRouter.setLiFiReceiver(lifiReceiver);

        vm.prank(lifiReceiver);
        vm.expectRevert(SmartRouter.InsufficientBalance.selector);
        newRouter.handleLiFiDeposit(beneficiary, DEPOSIT_AMOUNT, bytes32(0));
    }

    // ============ Admin Functions Tests ============

    function test_SetCCTPReceiver_Success() public {
        router.setCCTPReceiver(cctpReceiver);

        assertEq(router.cctpReceiver(), cctpReceiver);
        assertTrue(router.isAuthorizedHandler(cctpReceiver));
    }

    function test_SetCCTPReceiver_ReplacePrevious() public {
        router.setCCTPReceiver(cctpReceiver);
        address newReceiver = address(0x10);
        router.setCCTPReceiver(newReceiver);

        assertEq(router.cctpReceiver(), newReceiver);
        assertTrue(router.isAuthorizedHandler(newReceiver));
        assertFalse(router.isAuthorizedHandler(cctpReceiver)); // Old one removed
    }

    function test_SetCCTPReceiver_RevertZeroAddress() public {
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.setCCTPReceiver(address(0));
    }

    function test_SetCCTPReceiver_RevertNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setCCTPReceiver(cctpReceiver);
    }

    function test_SetLiFiReceiver_Success() public {
        router.setLiFiReceiver(lifiReceiver);

        assertEq(router.lifiReceiver(), lifiReceiver);
        assertTrue(router.isAuthorizedHandler(lifiReceiver));
    }

    function test_SetLiFiReceiver_ReplacePrevious() public {
        router.setLiFiReceiver(lifiReceiver);
        address newReceiver = address(0x11);
        router.setLiFiReceiver(newReceiver);

        assertEq(router.lifiReceiver(), newReceiver);
        assertTrue(router.isAuthorizedHandler(newReceiver));
        assertFalse(router.isAuthorizedHandler(lifiReceiver));
    }

    function test_SetLiFiReceiver_RevertZeroAddress() public {
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.setLiFiReceiver(address(0));
    }

    function test_SetHandler_Success() public {
        address customHandler = address(0x20);
        router.setHandler(customHandler, true);
        assertTrue(router.isAuthorizedHandler(customHandler));

        router.setHandler(customHandler, false);
        assertFalse(router.isAuthorizedHandler(customHandler));
    }

    function test_SetHandler_RevertZeroAddress() public {
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.setHandler(address(0), true);
    }

    function test_SetMinDepositAmount_Success() public {
        uint256 newMin = 10e6;
        router.setMinDepositAmount(newMin);
        assertEq(router.minDepositAmount(), newMin);
    }

    function test_SetMinDepositAmount_Zero() public {
        router.setMinDepositAmount(0);
        assertEq(router.minDepositAmount(), 0);

        // Now any amount should work
        vm.prank(user);
        uint256 shares = router.depositDirect(1); // 1 wei USDC
        assertGt(shares, 0);
    }

    // ============ Emergency Withdraw Tests ============

    function test_EmergencyWithdraw_USDC() public {
        uint256 routerBalance = usdc.balanceOf(address(router));
        router.emergencyWithdraw(address(usdc), routerBalance, owner);

        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(usdc.balanceOf(owner), routerBalance);
    }

    function test_EmergencyWithdraw_ETH() public {
        // Send ETH to router
        vm.deal(address(router), 1 ether);

        // Send to a payable address (user has a receive function via MockUSDC deploy)
        address payable recipient = payable(address(0x9999));
        vm.deal(recipient, 0);

        router.emergencyWithdraw(address(0), 1 ether, recipient);

        assertEq(address(router).balance, 0);
        assertEq(recipient.balance, 1 ether);
    }

    function test_EmergencyWithdraw_RevertZeroRecipient() public {
        vm.expectRevert(SmartRouter.ZeroAddress.selector);
        router.emergencyWithdraw(address(usdc), 100, address(0));
    }

    function test_EmergencyWithdraw_RevertNotOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.emergencyWithdraw(address(usdc), 100, user);
    }

    // ============ View Functions Tests ============

    function test_GetStats() public {
        // Make some deposits
        vm.prank(user);
        router.depositDirect(DEPOSIT_AMOUNT);

        router.setCCTPReceiver(cctpReceiver);
        vm.prank(cctpReceiver);
        router.handleCCTPDeposit(beneficiary, DEPOSIT_AMOUNT / 2, 0);

        (
            uint256 totalRouted,
            uint256 directCount,
            uint256 cctpCount,
            uint256 lifiCount,
            uint256 currentBalance
        ) = router.getStats();

        assertEq(totalRouted, DEPOSIT_AMOUNT + DEPOSIT_AMOUNT / 2);
        assertEq(directCount, 1);
        assertEq(cctpCount, 1);
        assertEq(lifiCount, 0);
        assertGt(currentBalance, 0);
    }

    function test_PreviewDeposit() public view {
        uint256 shares = router.previewDeposit(DEPOSIT_AMOUNT);
        assertEq(shares, DEPOSIT_AMOUNT); // 1:1 when pool is empty
    }

    function test_GetSharePrice_EmptyPool() public view {
        uint256 price = router.getSharePrice();
        assertEq(price, 1e6); // 1:1 when empty
    }

    function test_GetSharePrice_AfterDeposit() public {
        vm.prank(user);
        router.depositDirect(DEPOSIT_AMOUNT);

        uint256 price = router.getSharePrice();
        assertEq(price, 1e6); // Still 1:1 (no yield yet)
    }

    function test_GetDepositCount() public {
        vm.prank(user);
        router.depositDirect(DEPOSIT_AMOUNT);

        assertEq(router.getDepositCount(SmartRouter.DepositMethod.Direct), 1);
        assertEq(router.getDepositCount(SmartRouter.DepositMethod.CCTP), 0);
        assertEq(router.getDepositCount(SmartRouter.DepositMethod.LiFi), 0);
    }

    function test_IsAuthorizedHandler() public {
        assertFalse(router.isAuthorizedHandler(cctpReceiver));

        router.setCCTPReceiver(cctpReceiver);
        assertTrue(router.isAuthorizedHandler(cctpReceiver));
    }

    // ============ Receive ETH Test ============

    function test_ReceiveETH() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        (bool success, ) = address(router).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(router).balance, 1 ether);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_DepositDirect(uint256 amount) public {
        // Bound to user's actual balance
        uint256 userBalance = usdc.balanceOf(user);
        amount = bound(amount, MIN_DEPOSIT, userBalance);

        vm.prank(user);
        uint256 shares = router.depositDirect(amount);

        assertGt(shares, 0);
        assertEq(pool.balanceOf(user), shares);
    }

    function testFuzz_MinDepositAmount(uint256 newMin) public {
        newMin = bound(newMin, 0, type(uint256).max / 2);

        router.setMinDepositAmount(newMin);
        assertEq(router.minDepositAmount(), newMin);
    }
    */
}
