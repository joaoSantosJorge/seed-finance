// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "src/integrations/LiFiReceiver.sol";
import "src/base/LiquidityPool.sol";
import "./mocks/MockUSDC.sol";
import "./mocks/MockLiFiExecutor.sol";

contract LiFiReceiverTest is Test {
    LiFiReceiver public receiver;
    LiquidityPool public pool;
    MockUSDC public usdc;
    MockLiFiExecutor public lifiExecutor;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public unauthorizedExecutor = address(0x99);

    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC
    uint256 constant MIN_DEPOSIT = 10e6; // 10 USDC minimum

    function setUp() public {
        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        pool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Deploy LiFiReceiver
        receiver = new LiFiReceiver(
            address(usdc),
            address(pool),
            MIN_DEPOSIT
        );

        // Deploy MockLiFiExecutor
        lifiExecutor = new MockLiFiExecutor(address(usdc));

        // Authorize the LI.FI executor
        receiver.setExecutor(address(lifiExecutor), true);

        // Fund users and executor
        usdc.mint(user1, INITIAL_BALANCE);
        usdc.mint(user2, INITIAL_BALANCE);
        usdc.mint(address(lifiExecutor), INITIAL_BALANCE);

        // Approve contracts
        vm.prank(user1);
        usdc.approve(address(receiver), type(uint256).max);
        vm.prank(user2);
        usdc.approve(address(receiver), type(uint256).max);
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        assertEq(address(receiver.usdc()), address(usdc));
        assertEq(address(receiver.liquidityPool()), address(pool));
        assertEq(receiver.minDepositAmount(), MIN_DEPOSIT);
        assertEq(receiver.owner(), owner);
    }

    function test_ExecutorAuthorized() public view {
        assertTrue(receiver.isAuthorizedExecutor(address(lifiExecutor)));
        assertFalse(receiver.isAuthorizedExecutor(unauthorizedExecutor));
    }

    // ============ Direct Deposit Tests ============

    function test_DirectDeposit() public {
        uint256 depositAmount = 10_000e6;

        vm.prank(user1);
        receiver.directDeposit(depositAmount);

        // User should have SEED shares
        assertGt(pool.balanceOf(user1), 0);

        // Stats updated
        (uint256 totalReceived, uint256 totalDeposited, uint256 depositCount, ) = receiver.getStats();
        assertEq(totalReceived, depositAmount);
        assertEq(totalDeposited, depositAmount);
        assertEq(depositCount, 1);
    }

    function test_DirectDeposit_BelowMinimum() public {
        uint256 smallAmount = MIN_DEPOSIT - 1;

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                LiFiReceiver.AmountBelowMinimum.selector,
                smallAmount,
                MIN_DEPOSIT
            )
        );
        receiver.directDeposit(smallAmount);
    }

    function test_DirectDeposit_ZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(LiFiReceiver.ZeroAmount.selector);
        receiver.directDeposit(0);
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    function testFuzz_DirectDeposit(uint256 amount) public {
        amount = bound(amount, MIN_DEPOSIT, INITIAL_BALANCE);

        vm.prank(user1);
        receiver.directDeposit(amount);

        assertGt(pool.balanceOf(user1), 0);
    }
    */

    // ============ LI.FI Receive Tests ============

    function test_ReceiveAndDeposit() public {
        uint256 depositAmount = 50_000e6;

        // Simulate LI.FI bridge transfer
        bytes32 transferId = lifiExecutor.executeDirectTransfer(
            user1,
            depositAmount,
            address(receiver)
        );

        // User should have SEED shares
        assertGt(pool.balanceOf(user1), 0);

        // Verify stats
        (uint256 totalReceived, uint256 totalDeposited, uint256 depositCount, ) = receiver.getStats();
        assertEq(totalReceived, depositAmount);
        assertEq(totalDeposited, depositAmount);
        assertEq(depositCount, 1);

        // Verify transfer ID is non-zero
        assertTrue(transferId != bytes32(0));
    }

    function test_ReceiveAndDeposit_MultipleUsers() public {
        uint256 amount1 = 30_000e6;
        uint256 amount2 = 50_000e6;

        // User 1 deposit
        lifiExecutor.executeDirectTransfer(user1, amount1, address(receiver));

        // User 2 deposit
        lifiExecutor.executeDirectTransfer(user2, amount2, address(receiver));

        // Both users should have shares
        assertGt(pool.balanceOf(user1), 0);
        assertGt(pool.balanceOf(user2), 0);

        // Total stats
        (uint256 totalReceived, uint256 totalDeposited, uint256 depositCount, ) = receiver.getStats();
        assertEq(totalReceived, amount1 + amount2);
        assertEq(totalDeposited, amount1 + amount2);
        assertEq(depositCount, 2);
    }

    function test_ReceiveAndDeposit_WithData() public {
        uint256 depositAmount = 25_000e6;
        bytes memory data = abi.encode("referral", "ABC123");

        bytes32 transferId = lifiExecutor.executeDirectTransferWithData(
            user1,
            depositAmount,
            address(receiver),
            data
        );

        assertGt(pool.balanceOf(user1), 0);
        assertTrue(transferId != bytes32(0));
    }

    function test_ReceiveAndDeposit_UnauthorizedExecutor() public {
        uint256 depositAmount = 10_000e6;

        // Fund unauthorized executor
        usdc.mint(unauthorizedExecutor, depositAmount);

        vm.startPrank(unauthorizedExecutor);
        usdc.transfer(address(receiver), depositAmount);

        // Try to call receiveAndDeposit directly
        vm.expectRevert(
            abi.encodeWithSelector(
                LiFiReceiver.UnauthorizedExecutor.selector,
                unauthorizedExecutor
            )
        );
        receiver.receiveAndDeposit(user1, depositAmount, bytes32(uint256(1)));
        vm.stopPrank();
    }

    function test_ReceiveAndDeposit_InvalidUser() public {
        // Need to call directly since executor validates internally
        receiver.setExecutor(address(this), true);

        // Fund receiver
        usdc.mint(address(receiver), 10_000e6);

        vm.expectRevert(LiFiReceiver.InvalidUser.selector);
        receiver.receiveAndDeposit(address(0), 10_000e6, bytes32(uint256(1)));
    }

    // ============ Fallback Tests ============

    function test_FallbackToUser_BelowMinimum() public {
        // Authorize this test contract as executor
        receiver.setExecutor(address(this), true);

        uint256 smallAmount = MIN_DEPOSIT - 1;
        usdc.mint(address(receiver), smallAmount);

        uint256 userBalanceBefore = usdc.balanceOf(user1);

        // Call receiveAndDeposit with amount below minimum
        receiver.receiveAndDeposit(user1, smallAmount, bytes32(uint256(1)));

        // User should receive USDC directly (fallback)
        assertEq(usdc.balanceOf(user1), userBalanceBefore + smallAmount);

        // No shares minted
        assertEq(pool.balanceOf(user1), 0);
    }

    function test_FallbackToUser_InsufficientBalance() public {
        receiver.setExecutor(address(this), true);

        uint256 claimedAmount = 100_000e6;
        uint256 actualAmount = 50_000e6;

        // Fund receiver with less than claimed
        usdc.mint(address(receiver), actualAmount);

        uint256 userBalanceBefore = usdc.balanceOf(user1);

        // Call with claimed amount higher than actual balance
        receiver.receiveAndDeposit(user1, claimedAmount, bytes32(uint256(1)));

        // User should receive whatever was available
        assertEq(usdc.balanceOf(user1), userBalanceBefore + actualAmount);
    }

    // ============ Two-Step Transfer Test ============

    function test_TwoStepTransfer() public {
        uint256 depositAmount = 75_000e6;

        // Step 1: Simulate bridge (just record the transfer)
        bytes32 transferId = lifiExecutor.simulateBridgeTransfer(
            user1,
            depositAmount,
            address(receiver)
        );

        // Verify transfer recorded
        MockLiFiExecutor.Transfer memory transfer = lifiExecutor.getTransfer(transferId);
        assertEq(transfer.user, user1);
        assertEq(transfer.amount, depositAmount);
        assertFalse(transfer.executed);

        // Step 2: Execute the transfer
        lifiExecutor.executeTransfer(transferId);

        // Verify execution
        transfer = lifiExecutor.getTransfer(transferId);
        assertTrue(transfer.executed);

        // User should have shares
        assertGt(pool.balanceOf(user1), 0);
    }

    // ============ Preview Tests ============

    function test_PreviewDeposit() public view {
        uint256 depositAmount = 100_000e6;
        uint256 expectedShares = receiver.previewDeposit(depositAmount);

        // Should match pool's preview
        assertEq(expectedShares, pool.previewDeposit(depositAmount));
    }

    // ============ Admin Tests ============

    function test_SetExecutor() public {
        address newExecutor = address(0x123);

        receiver.setExecutor(newExecutor, true);
        assertTrue(receiver.isAuthorizedExecutor(newExecutor));

        receiver.setExecutor(newExecutor, false);
        assertFalse(receiver.isAuthorizedExecutor(newExecutor));
    }

    function test_SetExecutors_Batch() public {
        address[] memory executors = new address[](3);
        executors[0] = address(0x111);
        executors[1] = address(0x222);
        executors[2] = address(0x333);

        receiver.setExecutors(executors, true);

        assertTrue(receiver.isAuthorizedExecutor(executors[0]));
        assertTrue(receiver.isAuthorizedExecutor(executors[1]));
        assertTrue(receiver.isAuthorizedExecutor(executors[2]));
    }

    function test_SetMinDepositAmount() public {
        uint256 newMin = 100e6;
        receiver.setMinDepositAmount(newMin);
        assertEq(receiver.minDepositAmount(), newMin);
    }

    function test_SetExecutor_ZeroAddress() public {
        vm.expectRevert(LiFiReceiver.ZeroAddress.selector);
        receiver.setExecutor(address(0), true);
    }

    function test_SetExecutor_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        receiver.setExecutor(address(0x123), true);
    }

    // ============ Emergency Withdraw Tests ============

    function test_EmergencyWithdraw_ERC20() public {
        uint256 stuckAmount = 50_000e6;
        usdc.mint(address(receiver), stuckAmount);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);

        receiver.emergencyWithdraw(address(usdc), stuckAmount, owner);

        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + stuckAmount);
    }

    function test_EmergencyWithdraw_ETH() public {
        uint256 ethAmount = 1 ether;
        vm.deal(address(receiver), ethAmount);

        // Use user1 as recipient (regular EOA can receive ETH)
        uint256 user1BalanceBefore = user1.balance;

        receiver.emergencyWithdraw(address(0), ethAmount, user1);

        assertEq(user1.balance, user1BalanceBefore + ethAmount);
    }

    function test_RescueTokens() public {
        // Send random tokens to receiver
        MockUSDC otherToken = new MockUSDC();
        otherToken.mint(address(receiver), 1000e6);

        receiver.rescueTokens(address(otherToken), owner);

        assertEq(otherToken.balanceOf(owner), 1000e6);
        assertEq(otherToken.balanceOf(address(receiver)), 0);
    }

    function test_EmergencyWithdraw_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        receiver.emergencyWithdraw(address(usdc), 1000e6, user1);
    }

    // ============ Stats Tests ============

    function test_GetStats() public {
        // Make some deposits
        vm.prank(user1);
        receiver.directDeposit(10_000e6);

        lifiExecutor.executeDirectTransfer(user2, 20_000e6, address(receiver));

        (
            uint256 totalReceived,
            uint256 totalDeposited,
            uint256 depositCount,
            uint256 currentBalance
        ) = receiver.getStats();

        assertEq(totalReceived, 30_000e6);
        assertEq(totalDeposited, 30_000e6);
        assertEq(depositCount, 2);
        assertEq(currentBalance, 0); // All deposited to pool
    }

    // ============ Integration Tests ============

    function test_FullFlow_MultipleDeposits() public {
        // Simulate multiple users depositing through different methods

        // User 1: Direct deposit
        vm.prank(user1);
        receiver.directDeposit(100_000e6);

        // User 2: Via LI.FI bridge
        lifiExecutor.executeDirectTransfer(user2, 200_000e6, address(receiver));

        // User 1: Another LI.FI deposit
        lifiExecutor.executeDirectTransfer(user1, 50_000e6, address(receiver));

        // Verify total assets in pool
        assertEq(pool.totalAssets(), 350_000e6);

        // Verify individual balances
        // user1: 100k + 50k = 150k, user2: 200k
        assertEq(pool.balanceOf(user1), 150_000e6);
        assertEq(pool.balanceOf(user2), 200_000e6);

        // Verify stats
        (uint256 totalReceived, uint256 totalDeposited, uint256 depositCount, ) = receiver.getStats();
        assertEq(totalReceived, 350_000e6);
        assertEq(totalDeposited, 350_000e6);
        assertEq(depositCount, 3);
    }

    function test_SharesCalculation_Matches() public {
        uint256 depositAmount = 100_000e6;

        // Preview shares
        uint256 expectedShares = receiver.previewDeposit(depositAmount);

        // Execute deposit
        vm.prank(user1);
        receiver.directDeposit(depositAmount);

        // Verify shares match preview
        assertEq(pool.balanceOf(user1), expectedShares);
    }

    // ============ Receive ETH Test ============

    function test_ReceiveETH() public {
        uint256 ethAmount = 1 ether;
        vm.deal(user1, ethAmount);

        vm.prank(user1);
        (bool success, ) = address(receiver).call{value: ethAmount}("");
        assertTrue(success);
        assertEq(address(receiver).balance, ethAmount);
    }
}
