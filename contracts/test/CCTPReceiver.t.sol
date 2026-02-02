// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "src/integrations/CCTPReceiver.sol";
import "src/base/LiquidityPool.sol";
import "./mocks/MockUSDC.sol";

contract CCTPReceiverTest is Test {
    CCTPReceiver public receiver;
    LiquidityPool public pool;
    MockUSDC public usdc;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public messageTransmitter = address(0x7865fAfC2db2093669d92c0F33AeEF291086BEFD);

    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC
    uint256 constant MIN_DEPOSIT = 10e6; // 10 USDC minimum

    function setUp() public {
        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Deploy LiquidityPool
        pool = new LiquidityPool(IERC20(address(usdc)), "Seed", "SEED");

        // Deploy CCTPReceiver
        receiver = new CCTPReceiver(
            address(usdc),
            address(pool),
            messageTransmitter,
            MIN_DEPOSIT
        );

        // Fund users
        usdc.mint(user1, INITIAL_BALANCE);
        usdc.mint(user2, INITIAL_BALANCE);

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
        assertEq(receiver.messageTransmitter(), messageTransmitter);
        assertEq(receiver.minDepositAmount(), MIN_DEPOSIT);
        assertEq(receiver.owner(), owner);
    }

    function test_Deployment_ZeroUSDC_Reverts() public {
        vm.expectRevert(CCTPReceiver.ZeroAddress.selector);
        new CCTPReceiver(
            address(0),
            address(pool),
            messageTransmitter,
            MIN_DEPOSIT
        );
    }

    function test_Deployment_ZeroPool_Reverts() public {
        vm.expectRevert(CCTPReceiver.ZeroAddress.selector);
        new CCTPReceiver(
            address(usdc),
            address(0),
            messageTransmitter,
            MIN_DEPOSIT
        );
    }

    // ============ Direct Deposit Tests ============

    function test_DirectDeposit() public {
        uint256 depositAmount = 10_000e6;

        vm.prank(user1);
        receiver.directDeposit(depositAmount);

        // User should have SEED shares
        assertGt(pool.balanceOf(user1), 0);

        // Stats updated
        (
            uint256 totalReceived,
            uint256 totalDeposited,
            ,
            uint256 depositCount,
        ) = receiver.getStats();
        assertEq(totalReceived, depositAmount);
        assertEq(totalDeposited, depositAmount);
        assertEq(depositCount, 1);
    }

    function test_DirectDeposit_BelowMinimum() public {
        uint256 smallAmount = MIN_DEPOSIT - 1;

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                CCTPReceiver.AmountBelowMinimum.selector,
                smallAmount,
                MIN_DEPOSIT
            )
        );
        receiver.directDeposit(smallAmount);
    }

    function test_DirectDeposit_ZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(CCTPReceiver.ZeroAmount.selector);
        receiver.directDeposit(0);
    }

    function testFuzz_DirectDeposit(uint256 amount) public {
        amount = bound(amount, MIN_DEPOSIT, INITIAL_BALANCE);

        vm.prank(user1);
        receiver.directDeposit(amount);

        assertGt(pool.balanceOf(user1), 0);
    }

    // ============ CCTP Deposit Tests ============

    function test_ProcessCCTPDeposit() public {
        uint256 depositAmount = 50_000e6;
        bytes32 nonce = keccak256(abi.encodePacked("test-nonce-1"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        // Simulate CCTP minting USDC to receiver
        usdc.mint(address(receiver), depositAmount);

        // Process the CCTP deposit
        receiver.processCCTPDeposit(user1, depositAmount, sourceDomain, nonce);

        // User should have SEED shares
        assertGt(pool.balanceOf(user1), 0);
        assertEq(pool.balanceOf(user1), depositAmount); // 1:1 at start

        // Verify nonce is processed
        assertTrue(receiver.isNonceProcessed(nonce));

        // Verify stats
        (
            uint256 totalReceived,
            uint256 totalDeposited,
            ,
            uint256 depositCount,
        ) = receiver.getStats();
        assertEq(totalReceived, depositAmount);
        assertEq(totalDeposited, depositAmount);
        assertEq(depositCount, 1);
    }

    function test_ProcessCCTPDeposit_MultipleUsers() public {
        uint256 amount1 = 30_000e6;
        uint256 amount2 = 50_000e6;
        bytes32 nonce1 = keccak256(abi.encodePacked("nonce-1"));
        bytes32 nonce2 = keccak256(abi.encodePacked("nonce-2"));
        uint32 sourceDomain = receiver.DOMAIN_ARBITRUM();

        // Fund receiver
        usdc.mint(address(receiver), amount1 + amount2);

        // User 1 deposit
        receiver.processCCTPDeposit(user1, amount1, sourceDomain, nonce1);

        // User 2 deposit
        receiver.processCCTPDeposit(user2, amount2, sourceDomain, nonce2);

        // Both users should have shares
        assertEq(pool.balanceOf(user1), amount1);
        assertEq(pool.balanceOf(user2), amount2);

        // Total stats
        (
            uint256 totalReceived,
            uint256 totalDeposited,
            ,
            uint256 depositCount,
        ) = receiver.getStats();
        assertEq(totalReceived, amount1 + amount2);
        assertEq(totalDeposited, amount1 + amount2);
        assertEq(depositCount, 2);
    }

    function test_ProcessCCTPDeposit_ReplayPrevention() public {
        uint256 depositAmount = 25_000e6;
        bytes32 nonce = keccak256(abi.encodePacked("replay-test-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        // Fund and process first deposit
        usdc.mint(address(receiver), depositAmount);
        receiver.processCCTPDeposit(user1, depositAmount, sourceDomain, nonce);

        // Try to replay the same nonce
        usdc.mint(address(receiver), depositAmount);
        vm.expectRevert(
            abi.encodeWithSelector(
                CCTPReceiver.NonceAlreadyProcessed.selector,
                nonce
            )
        );
        receiver.processCCTPDeposit(user1, depositAmount, sourceDomain, nonce);
    }

    function test_ProcessCCTPDeposit_InvalidBeneficiary() public {
        uint256 depositAmount = 10_000e6;
        bytes32 nonce = keccak256(abi.encodePacked("test-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        usdc.mint(address(receiver), depositAmount);

        vm.expectRevert(CCTPReceiver.InvalidBeneficiary.selector);
        receiver.processCCTPDeposit(address(0), depositAmount, sourceDomain, nonce);
    }

    function test_ProcessCCTPDeposit_ZeroAmount() public {
        bytes32 nonce = keccak256(abi.encodePacked("zero-amount-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        vm.expectRevert(CCTPReceiver.ZeroAmount.selector);
        receiver.processCCTPDeposit(user1, 0, sourceDomain, nonce);
    }

    // ============ Pending Deposit Tests ============

    function test_ProcessCCTPDeposit_BelowMinimum_CreatesPending() public {
        uint256 smallAmount = MIN_DEPOSIT - 1;
        bytes32 nonce = keccak256(abi.encodePacked("small-deposit-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        usdc.mint(address(receiver), smallAmount);

        // Should create pending deposit instead of reverting
        receiver.processCCTPDeposit(user1, smallAmount, sourceDomain, nonce);

        // Check pending deposit
        assertEq(receiver.getPendingDeposit(user1), smallAmount);

        // No shares minted
        assertEq(pool.balanceOf(user1), 0);

        // Total pending updated
        (,, uint256 totalPending,,) = receiver.getStats();
        assertEq(totalPending, smallAmount);
    }

    function test_ClaimPendingDeposit() public {
        uint256 smallAmount = MIN_DEPOSIT - 1;
        bytes32 nonce = keccak256(abi.encodePacked("pending-claim-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        // Create pending deposit
        usdc.mint(address(receiver), smallAmount);
        receiver.processCCTPDeposit(user1, smallAmount, sourceDomain, nonce);

        // Add more to meet minimum via another small deposit
        bytes32 nonce2 = keccak256(abi.encodePacked("pending-claim-nonce-2"));
        uint256 additionalAmount = MIN_DEPOSIT - smallAmount + 1e6; // Just over minimum when combined
        usdc.mint(address(receiver), additionalAmount);
        receiver.processCCTPDeposit(user1, additionalAmount, sourceDomain, nonce2);

        uint256 totalPending = receiver.getPendingDeposit(user1);
        assertTrue(totalPending > 0);

        // Set minimum to 0 to allow claiming any amount
        receiver.setMinDepositAmount(0);

        // Claim pending deposit
        vm.prank(user1);
        receiver.claimPendingDeposit();

        // User should now have shares
        assertGt(pool.balanceOf(user1), 0);

        // Pending should be cleared
        assertEq(receiver.getPendingDeposit(user1), 0);
    }

    function test_ClaimPendingDeposit_NoPending_Reverts() public {
        vm.prank(user1);
        vm.expectRevert(CCTPReceiver.NoPendingDeposit.selector);
        receiver.claimPendingDeposit();
    }

    function test_WithdrawPendingDeposit() public {
        uint256 smallAmount = MIN_DEPOSIT - 1;
        bytes32 nonce = keccak256(abi.encodePacked("withdraw-pending-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        // Create pending deposit
        usdc.mint(address(receiver), smallAmount);
        receiver.processCCTPDeposit(user1, smallAmount, sourceDomain, nonce);

        uint256 user1BalanceBefore = usdc.balanceOf(user1);

        // Withdraw pending deposit
        vm.prank(user1);
        receiver.withdrawPendingDeposit();

        // User should have received USDC
        assertEq(usdc.balanceOf(user1), user1BalanceBefore + smallAmount);

        // Pending should be cleared
        assertEq(receiver.getPendingDeposit(user1), 0);

        // No shares minted
        assertEq(pool.balanceOf(user1), 0);
    }

    function test_WithdrawPendingDeposit_NoPending_Reverts() public {
        vm.prank(user1);
        vm.expectRevert(CCTPReceiver.NoPendingDeposit.selector);
        receiver.withdrawPendingDeposit();
    }

    function test_ProcessPendingDeposit_Admin() public {
        // Create a pending deposit with amount >= minimum
        uint256 depositAmount = MIN_DEPOSIT + 1e6;
        bytes32 nonce = keccak256(abi.encodePacked("admin-process-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        // First set minimum higher to force pending
        receiver.setMinDepositAmount(depositAmount + 1);

        usdc.mint(address(receiver), depositAmount);
        receiver.processCCTPDeposit(user1, depositAmount, sourceDomain, nonce);

        // Verify pending deposit
        assertEq(receiver.getPendingDeposit(user1), depositAmount);

        // Now lower minimum so deposit can succeed
        receiver.setMinDepositAmount(MIN_DEPOSIT);

        // Admin processes pending deposit
        receiver.processPendingDeposit(user1);

        // User should have shares
        assertGt(pool.balanceOf(user1), 0);

        // Pending cleared
        assertEq(receiver.getPendingDeposit(user1), 0);
    }

    function test_ProcessPendingDeposit_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        receiver.processPendingDeposit(user2);
    }

    // ============ Admin Tests ============

    function test_SetMessageTransmitter() public {
        address newTransmitter = address(0x123);
        receiver.setMessageTransmitter(newTransmitter);
        assertEq(receiver.messageTransmitter(), newTransmitter);
    }

    function test_SetMinDepositAmount() public {
        uint256 newMin = 100e6;
        receiver.setMinDepositAmount(newMin);
        assertEq(receiver.minDepositAmount(), newMin);
    }

    function test_SetMinDepositAmount_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        receiver.setMinDepositAmount(100e6);
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

        uint256 user1BalanceBefore = user1.balance;

        receiver.emergencyWithdraw(address(0), ethAmount, user1);

        assertEq(user1.balance, user1BalanceBefore + ethAmount);
    }

    function test_RescueTokens_ProtectsPending() public {
        // Create a pending deposit
        uint256 pendingAmount = MIN_DEPOSIT - 1;
        bytes32 nonce = keccak256(abi.encodePacked("rescue-protect-nonce"));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        usdc.mint(address(receiver), pendingAmount);
        receiver.processCCTPDeposit(user1, pendingAmount, sourceDomain, nonce);

        // Verify pending
        assertEq(receiver.getPendingDeposit(user1), pendingAmount);

        // Try to rescue all USDC - should leave pending amount
        uint256 extraUsdc = 100e6;
        usdc.mint(address(receiver), extraUsdc);

        uint256 ownerBalanceBefore = usdc.balanceOf(owner);
        receiver.rescueTokens(address(usdc), owner);

        // Only extra USDC should be rescued, not pending
        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + extraUsdc);

        // Pending still claimable
        assertEq(receiver.getPendingDeposit(user1), pendingAmount);
    }

    function test_EmergencyWithdraw_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        receiver.emergencyWithdraw(address(usdc), 1000e6, user1);
    }

    // ============ View Function Tests ============

    function test_GetStats() public {
        // Make some deposits
        vm.prank(user1);
        receiver.directDeposit(10_000e6);

        bytes32 nonce = keccak256(abi.encodePacked("stats-test-nonce"));
        usdc.mint(address(receiver), 20_000e6);
        receiver.processCCTPDeposit(user2, 20_000e6, receiver.DOMAIN_ETHEREUM(), nonce);

        (
            uint256 totalReceived,
            uint256 totalDeposited,
            uint256 totalPending,
            uint256 depositCount,
            uint256 currentBalance
        ) = receiver.getStats();

        assertEq(totalReceived, 30_000e6);
        assertEq(totalDeposited, 30_000e6);
        assertEq(totalPending, 0);
        assertEq(depositCount, 2);
        assertEq(currentBalance, 0); // All deposited to pool
    }

    function test_PreviewDeposit() public view {
        uint256 depositAmount = 100_000e6;
        uint256 expectedShares = receiver.previewDeposit(depositAmount);

        // Should match pool's preview
        assertEq(expectedShares, pool.previewDeposit(depositAmount));
    }

    function test_GetChainName() public view {
        assertEq(receiver.getChainName(0), "Ethereum");
        assertEq(receiver.getChainName(1), "Avalanche");
        assertEq(receiver.getChainName(2), "Optimism");
        assertEq(receiver.getChainName(3), "Arbitrum");
        assertEq(receiver.getChainName(5), "Solana");
        assertEq(receiver.getChainName(6), "Base");
        assertEq(receiver.getChainName(7), "Polygon");
        assertEq(receiver.getChainName(99), "Unknown");
    }

    // ============ Integration Tests ============

    function test_FullFlow_CCTPToShares() public {
        // Simulate complete CCTP flow
        uint256 depositAmount = 100_000e6;
        bytes32 nonce = keccak256(abi.encodePacked(block.timestamp, user1));
        uint32 sourceDomain = receiver.DOMAIN_ETHEREUM();

        // Step 1: USDC is minted to receiver (simulates CCTP receiveMessage)
        usdc.mint(address(receiver), depositAmount);

        // Step 2: Process the deposit
        receiver.processCCTPDeposit(user1, depositAmount, sourceDomain, nonce);

        // Step 3: Verify user has shares
        uint256 shares = pool.balanceOf(user1);
        assertEq(shares, depositAmount); // 1:1 at start

        // Step 4: Verify receiver has no USDC left
        assertEq(usdc.balanceOf(address(receiver)), 0);

        // Step 5: Verify pool has the USDC
        assertEq(pool.totalAssets(), depositAmount);
    }

    function test_FullFlow_MultipleSourceChains() public {
        // Simulate deposits from multiple chains
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 50_000e6;  // Ethereum
        amounts[1] = 75_000e6;  // Arbitrum
        amounts[2] = 25_000e6;  // Polygon

        uint32[] memory domains = new uint32[](3);
        domains[0] = receiver.DOMAIN_ETHEREUM();
        domains[1] = receiver.DOMAIN_ARBITRUM();
        domains[2] = receiver.DOMAIN_POLYGON();

        uint256 totalAmount = 0;
        for (uint i = 0; i < amounts.length; i++) {
            bytes32 nonce = keccak256(abi.encodePacked("multi-chain", i));
            usdc.mint(address(receiver), amounts[i]);
            receiver.processCCTPDeposit(user1, amounts[i], domains[i], nonce);
            totalAmount += amounts[i];
        }

        // Verify total shares
        assertEq(pool.balanceOf(user1), totalAmount);
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

    // ============ Fuzz Tests ============

    function testFuzz_ProcessCCTPDeposit(uint256 amount, uint32 sourceDomain) public {
        amount = bound(amount, MIN_DEPOSIT, 10_000_000e6); // Up to 10M USDC
        sourceDomain = uint32(bound(sourceDomain, 0, 7)); // Valid domain IDs

        bytes32 nonce = keccak256(abi.encodePacked(amount, sourceDomain));

        usdc.mint(address(receiver), amount);
        receiver.processCCTPDeposit(user1, amount, sourceDomain, nonce);

        assertEq(pool.balanceOf(user1), amount);
    }

    function testFuzz_PendingDeposits(uint256 amount1, uint256 amount2) public {
        // Bound to small amounts that will be pending
        amount1 = bound(amount1, 1, MIN_DEPOSIT - 1);
        amount2 = bound(amount2, 1, MIN_DEPOSIT - 1);

        bytes32 nonce1 = keccak256(abi.encodePacked("fuzz-pending-1", amount1));
        bytes32 nonce2 = keccak256(abi.encodePacked("fuzz-pending-2", amount2));

        usdc.mint(address(receiver), amount1);
        receiver.processCCTPDeposit(user1, amount1, receiver.DOMAIN_ETHEREUM(), nonce1);

        usdc.mint(address(receiver), amount2);
        receiver.processCCTPDeposit(user1, amount2, receiver.DOMAIN_ARBITRUM(), nonce2);

        // Total pending should be sum
        assertEq(receiver.getPendingDeposit(user1), amount1 + amount2);
    }
}
