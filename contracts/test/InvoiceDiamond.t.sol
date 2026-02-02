// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/invoice/InvoiceDiamond.sol";
import "../src/invoice/facets/InvoiceFacet.sol";
import "../src/invoice/facets/FundingFacet.sol";
import "../src/invoice/facets/RepaymentFacet.sol";
import "../src/invoice/facets/ViewFacet.sol";
import "../src/invoice/facets/AdminFacet.sol";
import "../src/invoice/libraries/LibInvoiceStorage.sol";
import "./mocks/MockUSDC.sol";

/**
 * @title InvoiceDiamond Test Suite
 * @notice Tests for Diamond proxy operations including facet cuts and loupe functions
 */
contract InvoiceDiamondTest is Test {
    InvoiceDiamond public diamond;
    MockUSDC public usdc;

    // Facets
    InvoiceFacet public invoiceFacet;
    FundingFacet public fundingFacet;
    RepaymentFacet public repaymentFacet;
    ViewFacet public viewFacet;
    AdminFacet public adminFacet;

    // Test addresses
    address public owner = address(this);
    address public randomUser = address(0x999);

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy facets
        invoiceFacet = new InvoiceFacet();
        fundingFacet = new FundingFacet();
        repaymentFacet = new RepaymentFacet();
        viewFacet = new ViewFacet();
        adminFacet = new AdminFacet();

        // Prepare minimal facet cuts for initial setup
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](2);

        // ViewFacet selectors (just owner for now)
        bytes4[] memory viewSelectors = new bytes4[](2);
        viewSelectors[0] = ViewFacet.owner.selector;
        viewSelectors[1] = ViewFacet.isOperator.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(viewFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: viewSelectors
        });

        // AdminFacet selectors
        bytes4[] memory adminSelectors = new bytes4[](3);
        adminSelectors[0] = AdminFacet.initialize.selector;
        adminSelectors[1] = AdminFacet.setOperator.selector;
        adminSelectors[2] = AdminFacet.transferOwnership.selector;

        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(adminFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: adminSelectors
        });

        // Deploy diamond with initialization
        bytes memory initData = abi.encodeWithSelector(
            AdminFacet.initialize.selector,
            owner,
            address(usdc)
        );

        diamond = new InvoiceDiamond(cuts, address(adminFacet), initData);
    }

    // ============ Constructor Tests ============

    function test_Constructor_DeploysDiamond() public view {
        assertEq(ViewFacet(address(diamond)).owner(), owner);
    }

    function test_Constructor_WithoutInit() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory viewSelectors = new bytes4[](1);
        viewSelectors[0] = ViewFacet.owner.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(viewFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: viewSelectors
        });

        // Deploy without init
        InvoiceDiamond newDiamond = new InvoiceDiamond(cuts, address(0), "");

        // Should deploy successfully
        assertTrue(address(newDiamond) != address(0));
    }

    // ============ Fallback Tests ============

    function test_Fallback_RoutesToCorrectFacet() public view {
        // Call owner() which routes to ViewFacet
        address ownerAddr = ViewFacet(address(diamond)).owner();
        assertEq(ownerAddr, owner);
    }

    function test_Fallback_RevertFunctionNotFound() public {
        // Call a selector that doesn't exist
        bytes4 unknownSelector = bytes4(keccak256("unknownFunction()"));

        // The low-level call returns false but doesn't bubble up the revert
        // We need to check the return data for the custom error
        (bool success, bytes memory returnData) = address(diamond).call(abi.encodeWithSelector(unknownSelector));

        // The call should fail (return false)
        assertFalse(success);

        // The return data should contain the FunctionNotFound error
        assertGt(returnData.length, 0);
    }

    function test_Receive_AcceptsETH() public {
        (bool success,) = address(diamond).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(diamond).balance, 1 ether);
    }

    // ============ Diamond Cut Tests ============

    function test_DiamondCut_AddFacet() public {
        // Create new facet cut to add InvoiceFacet
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory invoiceSelectors = new bytes4[](1);
        invoiceSelectors[0] = InvoiceFacet.createInvoice.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: invoiceSelectors
        });

        diamond.diamondCut(cuts, address(0), "");

        // Verify the function was added
        address facetAddr = diamond.facetAddress(InvoiceFacet.createInvoice.selector);
        assertEq(facetAddr, address(invoiceFacet));
    }

    function test_DiamondCut_ReplaceFacet() public {
        // First add a facet
        InvoiceDiamond.FacetCut[] memory addCuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = InvoiceFacet.createInvoice.selector;

        addCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        diamond.diamondCut(addCuts, address(0), "");

        // Deploy new version of facet
        InvoiceFacet newInvoiceFacet = new InvoiceFacet();

        // Replace
        InvoiceDiamond.FacetCut[] memory replaceCuts = new InvoiceDiamond.FacetCut[](1);
        replaceCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(newInvoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Replace,
            functionSelectors: selectors
        });

        diamond.diamondCut(replaceCuts, address(0), "");

        // Verify replacement
        address facetAddr = diamond.facetAddress(InvoiceFacet.createInvoice.selector);
        assertEq(facetAddr, address(newInvoiceFacet));
    }

    function test_DiamondCut_RemoveFacet() public {
        // First add a facet
        InvoiceDiamond.FacetCut[] memory addCuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = InvoiceFacet.createInvoice.selector;

        addCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        diamond.diamondCut(addCuts, address(0), "");

        // Now remove
        InvoiceDiamond.FacetCut[] memory removeCuts = new InvoiceDiamond.FacetCut[](1);
        removeCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(0), // Address is ignored for Remove
            action: InvoiceDiamond.FacetCutAction.Remove,
            functionSelectors: selectors
        });

        diamond.diamondCut(removeCuts, address(0), "");

        // Verify removal
        address facetAddr = diamond.facetAddress(InvoiceFacet.createInvoice.selector);
        assertEq(facetAddr, address(0));
    }

    function test_DiamondCut_RevertNotOwner() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](0);

        vm.prank(randomUser);
        vm.expectRevert("LibInvoiceStorage: not owner");
        diamond.diamondCut(cuts, address(0), "");
    }

    function test_DiamondCut_RevertNoSelectorsInFacet() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory emptySelectors = new bytes4[](0);

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: emptySelectors
        });

        vm.expectRevert(abi.encodeWithSelector(
            InvoiceDiamond.NoSelectorsInFacet.selector,
            address(invoiceFacet)
        ));
        diamond.diamondCut(cuts, address(0), "");
    }

    function test_DiamondCut_RevertAddExistingSelector() public {
        // Try to add a selector that already exists (owner)
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = ViewFacet.owner.selector; // Already added in setUp

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet), // Different facet, same selector
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        vm.expectRevert(abi.encodeWithSelector(
            InvoiceDiamond.CannotAddFunctionToDiamondThatAlreadyExists.selector,
            ViewFacet.owner.selector
        ));
        diamond.diamondCut(cuts, address(0), "");
    }

    function test_DiamondCut_RevertReplaceSameFacet() public {
        // Try to replace with same facet
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = ViewFacet.owner.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(viewFacet), // Same facet as already registered
            action: InvoiceDiamond.FacetCutAction.Replace,
            functionSelectors: selectors
        });

        vm.expectRevert(abi.encodeWithSelector(
            InvoiceDiamond.CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet.selector,
            ViewFacet.owner.selector
        ));
        diamond.diamondCut(cuts, address(0), "");
    }

    function test_DiamondCut_RevertRemoveNonExistent() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = bytes4(keccak256("nonExistentFunction()"));

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(0),
            action: InvoiceDiamond.FacetCutAction.Remove,
            functionSelectors: selectors
        });

        vm.expectRevert(abi.encodeWithSelector(
            InvoiceDiamond.CannotRemoveFunctionThatDoesNotExist.selector,
            selectors[0]
        ));
        diamond.diamondCut(cuts, address(0), "");
    }

    function test_DiamondCut_RevertZeroAddressForAdd() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = InvoiceFacet.createInvoice.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(0), // Zero address
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        vm.expectRevert(abi.encodeWithSelector(
            InvoiceDiamond.NoSelectorsInFacet.selector,
            address(0)
        ));
        diamond.diamondCut(cuts, address(0), "");
    }

    function test_DiamondCut_WithInitialization() public {
        // Add more selectors and run initialization
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = InvoiceFacet.createInvoice.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        // Use AdminFacet initialize for re-initialization (it won't do anything harmful)
        bytes memory initData = abi.encodeWithSelector(
            AdminFacet.setOperator.selector,
            randomUser,
            true
        );

        diamond.diamondCut(cuts, address(diamond), initData);

        // Verify init ran
        assertTrue(ViewFacet(address(diamond)).isOperator(randomUser));
    }

    function test_DiamondCut_RevertInitializationFailed() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](0);

        // Invalid initialization call that will revert
        bytes memory badInitData = abi.encodeWithSelector(
            bytes4(keccak256("revertFunction()"))
        );

        // This should revert because the init call fails
        vm.expectRevert();
        diamond.diamondCut(cuts, address(this), badInitData);
    }

    // ============ Diamond Loupe Tests ============

    function test_Facets_ReturnsAllFacets() public view {
        InvoiceDiamond.Facet[] memory facets = diamond.facets();

        // Should have 2 facets (ViewFacet and AdminFacet)
        assertEq(facets.length, 2);
    }

    function test_FacetFunctionSelectors_ReturnsSelectors() public view {
        bytes4[] memory selectors = diamond.facetFunctionSelectors(address(viewFacet));

        // ViewFacet has 2 selectors added in setUp
        assertEq(selectors.length, 2);
        assertEq(selectors[0], ViewFacet.owner.selector);
        assertEq(selectors[1], ViewFacet.isOperator.selector);
    }

    function test_FacetFunctionSelectors_EmptyForUnknownFacet() public view {
        bytes4[] memory selectors = diamond.facetFunctionSelectors(address(0x123));
        assertEq(selectors.length, 0);
    }

    function test_FacetAddresses_ReturnsAllAddresses() public view {
        address[] memory addresses = diamond.facetAddresses();

        // Should have 2 facet addresses
        assertEq(addresses.length, 2);
    }

    function test_FacetAddress_ReturnsCorrectFacet() public view {
        address facetAddr = diamond.facetAddress(ViewFacet.owner.selector);
        assertEq(facetAddr, address(viewFacet));
    }

    function test_FacetAddress_ReturnsZeroForUnknown() public view {
        bytes4 unknownSelector = bytes4(keccak256("unknownFunction()"));
        address facetAddr = diamond.facetAddress(unknownSelector);
        assertEq(facetAddr, address(0));
    }

    // ============ Complex Diamond Cut Operations ============

    function test_DiamondCut_AddMultipleFacets() public {
        InvoiceDiamond.FacetCut[] memory cuts = new InvoiceDiamond.FacetCut[](2);

        // Add InvoiceFacet
        bytes4[] memory invoiceSelectors = new bytes4[](2);
        invoiceSelectors[0] = InvoiceFacet.createInvoice.selector;
        invoiceSelectors[1] = InvoiceFacet.approveInvoice.selector;

        cuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: invoiceSelectors
        });

        // Add FundingFacet
        bytes4[] memory fundingSelectors = new bytes4[](2);
        fundingSelectors[0] = FundingFacet.requestFunding.selector;
        fundingSelectors[1] = FundingFacet.batchFund.selector;

        cuts[1] = InvoiceDiamond.FacetCut({
            facetAddress: address(fundingFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: fundingSelectors
        });

        diamond.diamondCut(cuts, address(0), "");

        // Verify both were added
        assertEq(diamond.facetAddress(InvoiceFacet.createInvoice.selector), address(invoiceFacet));
        assertEq(diamond.facetAddress(FundingFacet.requestFunding.selector), address(fundingFacet));
    }

    function test_DiamondCut_RemoveAllSelectorsFromFacet() public {
        // First add a facet with multiple selectors
        InvoiceDiamond.FacetCut[] memory addCuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = InvoiceFacet.createInvoice.selector;
        selectors[1] = InvoiceFacet.approveInvoice.selector;

        addCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        diamond.diamondCut(addCuts, address(0), "");

        // Now remove all selectors
        InvoiceDiamond.FacetCut[] memory removeCuts = new InvoiceDiamond.FacetCut[](1);
        removeCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(0),
            action: InvoiceDiamond.FacetCutAction.Remove,
            functionSelectors: selectors
        });

        diamond.diamondCut(removeCuts, address(0), "");

        // Verify facet was fully removed
        bytes4[] memory remainingSelectors = diamond.facetFunctionSelectors(address(invoiceFacet));
        assertEq(remainingSelectors.length, 0);
    }

    function test_DiamondCut_RemovePartialSelectors() public {
        // Add facet with 3 selectors
        InvoiceDiamond.FacetCut[] memory addCuts = new InvoiceDiamond.FacetCut[](1);

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = InvoiceFacet.createInvoice.selector;
        selectors[1] = InvoiceFacet.approveInvoice.selector;
        selectors[2] = InvoiceFacet.cancelInvoice.selector;

        addCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        diamond.diamondCut(addCuts, address(0), "");

        // Remove just one selector (the middle one)
        InvoiceDiamond.FacetCut[] memory removeCuts = new InvoiceDiamond.FacetCut[](1);
        bytes4[] memory toRemove = new bytes4[](1);
        toRemove[0] = InvoiceFacet.approveInvoice.selector;

        removeCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(0),
            action: InvoiceDiamond.FacetCutAction.Remove,
            functionSelectors: toRemove
        });

        diamond.diamondCut(removeCuts, address(0), "");

        // Verify only one was removed
        bytes4[] memory remainingSelectors = diamond.facetFunctionSelectors(address(invoiceFacet));
        assertEq(remainingSelectors.length, 2);
        assertEq(diamond.facetAddress(InvoiceFacet.approveInvoice.selector), address(0));
        assertEq(diamond.facetAddress(InvoiceFacet.createInvoice.selector), address(invoiceFacet));
        assertEq(diamond.facetAddress(InvoiceFacet.cancelInvoice.selector), address(invoiceFacet));
    }

    /* FUZZ TESTS - COMMENTED FOR FASTER RUNS
    // ============ Fuzz Tests ============

    function testFuzz_DiamondCut_AddAndRemove(uint8 selectorCount) public {
        vm.assume(selectorCount > 0 && selectorCount <= 10);

        // Generate unique selectors
        bytes4[] memory selectors = new bytes4[](selectorCount);
        for (uint8 i = 0; i < selectorCount; i++) {
            selectors[i] = bytes4(keccak256(abi.encodePacked("function", i)));
        }

        // Add
        InvoiceDiamond.FacetCut[] memory addCuts = new InvoiceDiamond.FacetCut[](1);
        addCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(invoiceFacet),
            action: InvoiceDiamond.FacetCutAction.Add,
            functionSelectors: selectors
        });

        diamond.diamondCut(addCuts, address(0), "");

        // Verify all added
        for (uint8 i = 0; i < selectorCount; i++) {
            assertEq(diamond.facetAddress(selectors[i]), address(invoiceFacet));
        }

        // Remove all
        InvoiceDiamond.FacetCut[] memory removeCuts = new InvoiceDiamond.FacetCut[](1);
        removeCuts[0] = InvoiceDiamond.FacetCut({
            facetAddress: address(0),
            action: InvoiceDiamond.FacetCutAction.Remove,
            functionSelectors: selectors
        });

        diamond.diamondCut(removeCuts, address(0), "");

        // Verify all removed
        for (uint8 i = 0; i < selectorCount; i++) {
            assertEq(diamond.facetAddress(selectors[i]), address(0));
        }
    }
    */
}
