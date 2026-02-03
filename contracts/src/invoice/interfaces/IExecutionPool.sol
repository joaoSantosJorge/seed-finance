// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IExecutionPool
 * @notice Interface for ExecutionPool used by InvoiceDiamond facets
 */
interface IExecutionPool {
    /**
     * @notice Receive repayment from buyer
     * @dev Called by InvoiceDiamond after buyer transfers USDC
     * @param invoiceId The invoice being repaid
     * @param buyer Address of the buyer making repayment
     */
    function receiveRepayment(uint256 invoiceId, address buyer) external;

    /**
     * @notice Check if an invoice has been funded
     * @param invoiceId The invoice ID
     * @return True if the invoice has been funded
     */
    function isInvoiceFunded(uint256 invoiceId) external view returns (bool);

    /**
     * @notice Check if an invoice has been repaid
     * @param invoiceId The invoice ID
     * @return True if the invoice has been repaid
     */
    function isInvoiceRepaid(uint256 invoiceId) external view returns (bool);
}
