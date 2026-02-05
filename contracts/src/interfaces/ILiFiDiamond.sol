// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ILiFiDiamond
 * @notice Interface for LI.FI Diamond contract
 */
interface ILiFiDiamond {
    struct BridgeData {
        bytes32 transactionId;
        string bridge;
        string integrator;
        address referrer;
        address sendingAssetId;
        address receiver;
        uint256 minAmount;
        uint256 destinationChainId;
        bool hasSourceSwaps;
        bool hasDestinationCall;
    }

    function startBridgeTokensViaBridge(BridgeData calldata _bridgeData) external payable;
}
