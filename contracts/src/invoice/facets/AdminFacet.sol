// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/LibInvoiceStorage.sol";

/**
 * @title AdminFacet
 * @notice Admin functions for the Invoice Diamond
 * @dev Part of the Invoice Diamond - handles configuration and access control
 */
contract AdminFacet {
    using LibInvoiceStorage for LibInvoiceStorage.Storage;

    // ============ Events ============

    event ExecutionPoolUpdated(address indexed oldPool, address indexed newPool);
    event LiquidityPoolUpdated(address indexed oldPool, address indexed newPool);
    event USDCUpdated(address indexed oldUsdc, address indexed newUsdc);
    event OperatorUpdated(address indexed operator, bool status);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    error Unauthorized(address caller, string role);
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyOwner() {
        LibInvoiceStorage.enforceIsOwner();
        _;
    }

    // ============ Configuration Functions ============

    /**
     * @notice Set ExecutionPool address
     * @param _executionPool New ExecutionPool address
     */
    function setExecutionPool(address _executionPool) external onlyOwner {
        if (_executionPool == address(0)) revert ZeroAddress();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        address oldPool = s.executionPool;
        s.executionPool = _executionPool;

        emit ExecutionPoolUpdated(oldPool, _executionPool);
    }

    /**
     * @notice Set LiquidityPool address
     * @param _liquidityPool New LiquidityPool address
     */
    function setLiquidityPool(address _liquidityPool) external onlyOwner {
        if (_liquidityPool == address(0)) revert ZeroAddress();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        address oldPool = s.liquidityPool;
        s.liquidityPool = _liquidityPool;

        emit LiquidityPoolUpdated(oldPool, _liquidityPool);
    }

    /**
     * @notice Set USDC address
     * @param _usdc New USDC address
     */
    function setUSDC(address _usdc) external onlyOwner {
        if (_usdc == address(0)) revert ZeroAddress();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        address oldUsdc = s.usdc;
        s.usdc = _usdc;

        emit USDCUpdated(oldUsdc, _usdc);
    }

    /**
     * @notice Set operator status
     * @param operator Address to set
     * @param status True to grant, false to revoke
     */
    function setOperator(address operator, bool status) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        s.operators[operator] = status;

        emit OperatorUpdated(operator, status);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();
        address previousOwner = s.owner;
        s.owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /**
     * @notice Initialize the Diamond (called once during deployment)
     * @param _owner Owner address
     * @param _usdc USDC address
     */
    function initialize(address _owner, address _usdc) external {
        LibInvoiceStorage.Storage storage s = LibInvoiceStorage.getStorage();

        // Can only initialize once
        require(s.owner == address(0), "Already initialized");
        require(_owner != address(0), "Invalid owner");
        require(_usdc != address(0), "Invalid USDC");

        s.owner = _owner;
        s.usdc = _usdc;
        s.nextInvoiceId = 1; // Start from 1, 0 is reserved

        emit OwnershipTransferred(address(0), _owner);
        emit USDCUpdated(address(0), _usdc);
    }
}
