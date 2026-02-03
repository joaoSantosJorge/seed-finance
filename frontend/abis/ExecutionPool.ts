/**
 * ExecutionPool ABI
 * Handles invoice funding and repayment operations
 */
export const executionPoolAbi = [
  // ============ Funding Functions ============
  {
    name: 'fundInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'supplier', type: 'address' },
      { name: 'fundingAmount', type: 'uint128' },
      { name: 'faceValue', type: 'uint128' },
    ],
    outputs: [],
  },
  {
    name: 'receiveRepayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'buyer', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'repayInvoice',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [],
  },

  // ============ Configuration Functions ============
  {
    name: 'setLiquidityPool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_liquidityPool', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setInvoiceDiamond',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_invoiceDiamond', type: 'address' }],
    outputs: [],
  },

  // ============ View Functions ============
  {
    name: 'getFundingRecord',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'supplier', type: 'address' },
          { name: 'fundingAmount', type: 'uint128' },
          { name: 'faceValue', type: 'uint128' },
          { name: 'fundedAt', type: 'uint64' },
          { name: 'funded', type: 'bool' },
          { name: 'repaid', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'isInvoiceFunded',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isInvoiceRepaid',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'availableBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalFunded', type: 'uint256' },
      { name: 'totalRepaid', type: 'uint256' },
      { name: 'activeInvoices', type: 'uint256' },
    ],
  },
  {
    name: 'liquidityPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'invoiceDiamond',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'usdc',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },

  // ============ Role Functions ============
  {
    name: 'OPERATOR_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'DIAMOND_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'hasRole',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },

  // ============ Events ============
  {
    name: 'InvoiceFunded',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'supplier', type: 'address', indexed: true },
      { name: 'fundingAmount', type: 'uint128', indexed: false },
      { name: 'faceValue', type: 'uint128', indexed: false },
    ],
  },
  {
    name: 'RepaymentReceived',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'YieldReturned',
    type: 'event',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'principal', type: 'uint256', indexed: false },
      { name: 'yield', type: 'uint256', indexed: false },
    ],
  },
] as const;
