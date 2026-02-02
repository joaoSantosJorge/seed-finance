// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./libraries/LibInvoiceStorage.sol";

/**
 * @title InvoiceDiamond
 * @notice Diamond proxy for the Invoice system (EIP-2535)
 * @dev Routes calls to appropriate facets based on function selectors
 *
 * Architecture:
 * - Uses diamond storage pattern to prevent collisions
 * - Supports adding/replacing/removing facets dynamically
 * - All invoice state is stored in LibInvoiceStorage
 *
 * Deployed Facets:
 * - InvoiceFacet: create, approve, cancel invoices
 * - FundingFacet: request funding, batch fund
 * - RepaymentFacet: process repayments, mark defaults
 * - ViewFacet: read-only queries
 * - AdminFacet: configuration and access control
 */
contract InvoiceDiamond {
    // ============ Diamond Storage ============

    /// @dev Storage slot for diamond cut storage
    bytes32 constant DIAMOND_STORAGE_SLOT = keccak256("seedfinance.invoice.diamond.cut");

    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 functionSelectorPosition;
    }

    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint256 facetAddressPosition;
    }

    struct DiamondStorage {
        // Maps function selector to facet address and position
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        // Maps facet addresses to function selectors
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        // Facet addresses (for enumeration)
        address[] facetAddresses;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_SLOT;
        assembly {
            ds.slot := position
        }
    }

    // ============ Events ============

    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);

    // ============ Enums ============

    enum FacetCutAction { Add, Replace, Remove }

    // ============ Structs ============

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    // ============ Errors ============

    error FunctionNotFound(bytes4 selector);
    error IncorrectFacetCutAction(uint8 action);
    error NoSelectorsInFacet(address facet);
    error CannotAddFunctionToDiamondThatAlreadyExists(bytes4 selector);
    error CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet(bytes4 selector);
    error CannotRemoveFunctionThatDoesNotExist(bytes4 selector);
    error CannotRemoveImmutableFunction(bytes4 selector);
    error InitializationFunctionReverted(address init, bytes data);

    // ============ Constructor ============

    /**
     * @notice Deploy the diamond with initial facets
     * @param _facetCuts Array of facet cuts to add
     * @param _init Address of contract with initialization function
     * @param _calldata Calldata for initialization function
     */
    constructor(
        FacetCut[] memory _facetCuts,
        address _init,
        bytes memory _calldata
    ) {
        _executeDiamondCut(_facetCuts, _init, _calldata);
    }

    // ============ Fallback ============

    /**
     * @notice Routes all calls to appropriate facet
     */
    fallback() external payable {
        DiamondStorage storage ds = diamondStorage();
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        if (facet == address(0)) revert FunctionNotFound(msg.sig);

        assembly {
            // Copy calldata
            calldatacopy(0, 0, calldatasize())
            // Delegatecall to facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // Copy return data
            returndatacopy(0, 0, returndatasize())
            // Return or revert based on result
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}

    // ============ Diamond Cut Functions ============

    /**
     * @notice Add/replace/remove facet functions
     * @dev Only callable by owner (via AdminFacet)
     * @param _cuts Array of facet cuts
     * @param _init Address of contract with initialization function
     * @param _calldata Calldata for initialization function
     */
    function diamondCut(
        FacetCut[] calldata _cuts,
        address _init,
        bytes calldata _calldata
    ) external {
        LibInvoiceStorage.enforceIsOwner();
        _executeDiamondCut(_cuts, _init, _calldata);
    }

    function _executeDiamondCut(
        FacetCut[] memory _cuts,
        address _init,
        bytes memory _calldata
    ) internal {
        for (uint256 facetIndex; facetIndex < _cuts.length; facetIndex++) {
            FacetCutAction action = _cuts[facetIndex].action;
            if (action == FacetCutAction.Add) {
                _addFunctions(
                    _cuts[facetIndex].facetAddress,
                    _cuts[facetIndex].functionSelectors
                );
            } else if (action == FacetCutAction.Replace) {
                _replaceFunctions(
                    _cuts[facetIndex].facetAddress,
                    _cuts[facetIndex].functionSelectors
                );
            } else if (action == FacetCutAction.Remove) {
                _removeFunctions(
                    _cuts[facetIndex].facetAddress,
                    _cuts[facetIndex].functionSelectors
                );
            } else {
                revert IncorrectFacetCutAction(uint8(action));
            }
        }
        emit DiamondCut(_cuts, _init, _calldata);
        _initializeDiamondCut(_init, _calldata);
    }

    function _addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        if (_functionSelectors.length == 0) revert NoSelectorsInFacet(_facetAddress);
        DiamondStorage storage ds = diamondStorage();

        if (_facetAddress == address(0)) revert NoSelectorsInFacet(_facetAddress);

        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);

        // Add new facet address if it doesn't exist
        if (selectorPosition == 0) {
            _addFacet(ds, _facetAddress);
        }

        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            if (oldFacetAddress != address(0)) {
                revert CannotAddFunctionToDiamondThatAlreadyExists(selector);
            }
            _addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    function _replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        if (_functionSelectors.length == 0) revert NoSelectorsInFacet(_facetAddress);
        DiamondStorage storage ds = diamondStorage();

        if (_facetAddress == address(0)) revert NoSelectorsInFacet(_facetAddress);

        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);

        if (selectorPosition == 0) {
            _addFacet(ds, _facetAddress);
        }

        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            if (oldFacetAddress == _facetAddress) {
                revert CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet(selector);
            }
            _removeFunction(ds, oldFacetAddress, selector);
            _addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    function _removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        if (_functionSelectors.length == 0) revert NoSelectorsInFacet(_facetAddress);
        DiamondStorage storage ds = diamondStorage();

        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            _removeFunction(ds, oldFacetAddress, selector);
        }
    }

    function _addFacet(DiamondStorage storage ds, address _facetAddress) internal {
        ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = ds.facetAddresses.length;
        ds.facetAddresses.push(_facetAddress);
    }

    function _addFunction(
        DiamondStorage storage ds,
        bytes4 _selector,
        uint96 _selectorPosition,
        address _facetAddress
    ) internal {
        ds.selectorToFacetAndPosition[_selector].functionSelectorPosition = _selectorPosition;
        ds.selectorToFacetAndPosition[_selector].facetAddress = _facetAddress;
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.push(_selector);
    }

    function _removeFunction(DiamondStorage storage ds, address _facetAddress, bytes4 _selector) internal {
        if (_facetAddress == address(0)) revert CannotRemoveFunctionThatDoesNotExist(_selector);
        if (_facetAddress == address(this)) revert CannotRemoveImmutableFunction(_selector);

        uint256 selectorPosition = ds.selectorToFacetAndPosition[_selector].functionSelectorPosition;
        uint256 lastSelectorPosition = ds.facetFunctionSelectors[_facetAddress].functionSelectors.length - 1;

        if (selectorPosition != lastSelectorPosition) {
            bytes4 lastSelector = ds.facetFunctionSelectors[_facetAddress].functionSelectors[lastSelectorPosition];
            ds.facetFunctionSelectors[_facetAddress].functionSelectors[selectorPosition] = lastSelector;
            ds.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint96(selectorPosition);
        }

        ds.facetFunctionSelectors[_facetAddress].functionSelectors.pop();
        delete ds.selectorToFacetAndPosition[_selector];

        if (lastSelectorPosition == 0) {
            uint256 lastFacetAddressPosition = ds.facetAddresses.length - 1;
            uint256 facetAddressPosition = ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
            if (facetAddressPosition != lastFacetAddressPosition) {
                address lastFacetAddress = ds.facetAddresses[lastFacetAddressPosition];
                ds.facetAddresses[facetAddressPosition] = lastFacetAddress;
                ds.facetFunctionSelectors[lastFacetAddress].facetAddressPosition = facetAddressPosition;
            }
            ds.facetAddresses.pop();
            delete ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
        }
    }

    function _initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) {
            return;
        }
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                assembly {
                    let returndata_size := mload(error)
                    revert(add(32, error), returndata_size)
                }
            } else {
                revert InitializationFunctionReverted(_init, _calldata);
            }
        }
    }

    // ============ Diamond Loupe Functions ============

    /**
     * @notice Get all facets and their selectors
     * @return facets_ Array of facet addresses and selectors
     */
    function facets() external view returns (Facet[] memory facets_) {
        DiamondStorage storage ds = diamondStorage();
        uint256 numFacets = ds.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddress_ = ds.facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = ds.facetFunctionSelectors[facetAddress_].functionSelectors;
        }
    }

    /**
     * @notice Get function selectors for a facet
     * @param _facet Facet address
     * @return facetFunctionSelectors_ Function selectors
     */
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_) {
        DiamondStorage storage ds = diamondStorage();
        facetFunctionSelectors_ = ds.facetFunctionSelectors[_facet].functionSelectors;
    }

    /**
     * @notice Get all facet addresses
     * @return facetAddresses_ Array of facet addresses
     */
    function facetAddresses() external view returns (address[] memory facetAddresses_) {
        DiamondStorage storage ds = diamondStorage();
        facetAddresses_ = ds.facetAddresses;
    }

    /**
     * @notice Get facet address for a function selector
     * @param _functionSelector Function selector
     * @return facetAddress_ Facet address
     */
    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_) {
        DiamondStorage storage ds = diamondStorage();
        facetAddress_ = ds.selectorToFacetAndPosition[_functionSelector].facetAddress;
    }

    // ============ Structs for Loupe ============

    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }
}
