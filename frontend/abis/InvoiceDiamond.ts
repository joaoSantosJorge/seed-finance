/**
 * InvoiceDiamond ABI
 * Combined ABI for all facets of the Invoice Diamond
 */
export const invoiceDiamondAbi = [
  // ============ InvoiceFacet ============
  {
    name: 'createInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer', type: 'address' },
      { name: 'faceValue', type: 'uint128' },
      { name: 'discountRateBps', type: 'uint16' },
      { name: 'maturityDate', type: 'uint64' },
      { name: 'invoiceHash', type: 'bytes32' },
      { name: 'externalId', type: 'bytes32' },
    ],
    outputs: [{ name: 'invoiceId', type: 'uint256' }],
  },
  {
    name: 'approveInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'cancelInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },

  // ============ FundingFacet ============
  {
    name: 'requestFunding',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'batchFund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceIds', type: 'uint256[]' }],
    outputs: [],
  },
  {
    name: 'canFundInvoice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [{ name: 'canFund', type: 'bool' }],
  },
  {
    name: 'getFundingAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [{ name: 'amount', type: 'uint128' }],
  },

  // ============ RepaymentFacet ============
  {
    name: 'processRepayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getRepaymentAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [{ name: 'amount', type: 'uint128' }],
  },
  {
    name: 'isOverdue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [{ name: 'overdue', type: 'bool' }],
  },
  {
    name: 'markDefaulted',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },

  // ============ ViewFacet ============
  {
    name: 'getInvoice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [
      {
        name: 'invoice',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'buyer', type: 'address' },
          { name: 'supplier', type: 'address' },
          { name: 'faceValue', type: 'uint128' },
          { name: 'fundingAmount', type: 'uint128' },
          { name: 'maturityDate', type: 'uint64' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'fundedAt', type: 'uint64' },
          { name: 'paidAt', type: 'uint64' },
          { name: 'discountRateBps', type: 'uint16' },
          { name: 'status', type: 'uint8' },
          { name: 'invoiceHash', type: 'bytes32' },
          { name: 'externalId', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    name: 'getSupplierInvoices',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'supplier', type: 'address' }],
    outputs: [{ name: 'invoiceIds', type: 'uint256[]' }],
  },
  {
    name: 'getBuyerInvoices',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ name: 'invoiceIds', type: 'uint256[]' }],
  },
  {
    name: 'getPendingApprovals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ name: 'invoiceIds', type: 'uint256[]' }],
  },
  {
    name: 'getUpcomingRepayments',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ name: 'invoiceIds', type: 'uint256[]' }],
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalFunded', type: 'uint256' },
      { name: 'totalRepaid', type: 'uint256' },
      { name: 'activeCount', type: 'uint256' },
      { name: 'nextId', type: 'uint256' },
    ],
  },
  {
    name: 'getContractAddresses',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'executionPool', type: 'address' },
      { name: 'liquidityPool', type: 'address' },
      { name: 'usdc', type: 'address' },
    ],
  },
  {
    name: 'isOperator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: 'isOp', type: 'bool' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },

  // ============ AdminFacet ============
  {
    name: 'setExecutionPool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_executionPool', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setLiquidityPool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_liquidityPool', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setUSDC',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_usdc', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setOperator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'transferOwnership',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
  },

  // ============ Events ============
  {
    name: 'InvoiceCreated',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'supplier', type: 'address', indexed: true },
      { name: 'faceValue', type: 'uint128', indexed: false },
      { name: 'discountRateBps', type: 'uint16', indexed: false },
      { name: 'maturityDate', type: 'uint64', indexed: false },
    ],
  },
  {
    name: 'InvoiceApproved',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'approvedAt', type: 'uint64', indexed: false },
    ],
  },
  {
    name: 'InvoiceFunded',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'supplier', type: 'address', indexed: true },
      { name: 'fundingAmount', type: 'uint128', indexed: false },
      { name: 'discount', type: 'uint128', indexed: false },
      { name: 'fundedAt', type: 'uint64', indexed: false },
    ],
  },
  {
    name: 'InvoicePaid',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'amountPaid', type: 'uint128', indexed: false },
      { name: 'paidAt', type: 'uint64', indexed: false },
    ],
  },
  {
    name: 'InvoiceCancelled',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'cancelledBy', type: 'address', indexed: true },
      { name: 'cancelledAt', type: 'uint64', indexed: false },
    ],
  },
] as const;
