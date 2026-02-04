#!/usr/bin/env npx ts-node
/**
 * Full Yield Simulation Workflow
 *
 * This script demonstrates the complete yield accrual process:
 * 1. Shows initial pool state
 * 2. Creates and funds an invoice
 * 3. Advances time to maturity
 * 4. Processes repayment
 * 5. Shows final state with yield accrual
 *
 * Prerequisites:
 * - Anvil running with deployed contracts (use TestWorkflow.s.sol first)
 * - Or run with fresh deployment flag
 *
 * Usage:
 *   # With existing deployment
 *   npx ts-node backend/scripts/simulateYieldWorkflow.ts
 *
 *   # View the full workflow (requires TestWorkflow.s.sol to be run first)
 *   npx ts-node backend/scripts/simulateYieldWorkflow.ts --view-only
 *
 * Environment:
 *   RPC_URL - Anvil RPC URL (default: http://127.0.0.1:8545)
 *   TIME_SOURCE - 'system' or 'blockchain' (default: blockchain for this script)
 */

import { createTestClient, createPublicClient, http, formatUnits } from 'viem';
import { foundry } from 'viem/chains';
import { timeProvider } from '../lib/timeProvider';

// ============ Configuration ============

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// Force blockchain time mode for this script
timeProvider.useBlockchainTime(RPC_URL);

// ============ ABIs (minimal for reading) ============

const LIQUIDITY_POOL_ABI = [
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalDeployed',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalInvoiceYield',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'availableLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'shares' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const EXECUTION_POOL_ABI = [
  {
    name: 'totalFunded',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalRepaid',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'activeInvoices',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ============ Helpers ============

function formatUsdc(value: bigint): string {
  return formatUnits(value, 6);
}

function formatSeed(value: bigint): string {
  return formatUnits(value, 18);
}

function printSeparator(title: string): void {
  console.log('');
  console.log('='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  console.log('');
}

// ============ Main Functions ============

interface PoolState {
  totalAssets: bigint;
  totalSupply: bigint;
  totalDeployed: bigint;
  totalInvoiceYield: bigint;
  availableLiquidity: bigint;
  sharePrice: bigint;
  blockTime: Date;
  blockNumber: bigint;
}

async function getPoolState(
  poolAddress: string,
  publicClient: ReturnType<typeof createPublicClient>
): Promise<PoolState> {
  const [totalAssets, totalSupply, totalDeployed, totalInvoiceYield, availableLiquidity, block] =
    await Promise.all([
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'totalAssets',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'totalSupply',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'totalDeployed',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'totalInvoiceYield',
      }),
      publicClient.readContract({
        address: poolAddress as `0x${string}`,
        abi: LIQUIDITY_POOL_ABI,
        functionName: 'availableLiquidity',
      }),
      publicClient.getBlock(),
    ]);

  let sharePrice = BigInt(1e6); // 1:1 default
  if (totalSupply > 0n) {
    sharePrice = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: LIQUIDITY_POOL_ABI,
      functionName: 'convertToAssets',
      args: [BigInt(1e18)], // Price of 1 SEED
    });
  }

  return {
    totalAssets,
    totalSupply,
    totalDeployed,
    totalInvoiceYield,
    availableLiquidity,
    sharePrice,
    blockTime: new Date(Number(block.timestamp) * 1000),
    blockNumber: block.number,
  };
}

function printPoolState(state: PoolState, label: string): void {
  console.log(`${label}:`);
  console.log(`  Block Number:        ${state.blockNumber}`);
  console.log(`  Block Time:          ${state.blockTime.toISOString()}`);
  console.log(`  Total Assets:        ${formatUsdc(state.totalAssets)} USDC`);
  console.log(`  Total SEED Supply:   ${formatSeed(state.totalSupply)} SEED`);
  console.log(`  Total Deployed:      ${formatUsdc(state.totalDeployed)} USDC`);
  console.log(`  Available Liquidity: ${formatUsdc(state.availableLiquidity)} USDC`);
  console.log(`  Total Invoice Yield: ${formatUsdc(state.totalInvoiceYield)} USDC`);
  console.log(`  Share Price:         ${state.sharePrice} wei (${formatUsdc(state.sharePrice)} USDC per SEED)`);
  console.log('');
}

async function advanceTime(
  testClient: ReturnType<typeof createTestClient>,
  days: number
): Promise<void> {
  const seconds = days * 24 * 60 * 60;
  console.log(`Advancing time by ${days} days (${seconds.toLocaleString()} seconds)...`);

  await testClient.increaseTime({ seconds });
  await testClient.mine({ blocks: 1 });

  // Clear the time provider cache
  timeProvider.clearCache();

  console.log('Time advanced and new block mined.');
  console.log('');
}

async function runSimulation(): Promise<void> {
  printSeparator('YIELD SIMULATION WORKFLOW');

  console.log('This script demonstrates how yield accrual works over time.');
  console.log('');
  console.log('Configuration:');
  console.log(`  RPC URL:     ${RPC_URL}`);
  console.log(`  Time Source: ${timeProvider.getSource()}`);
  console.log('');

  // Create clients
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
  });

  const testClient = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http(RPC_URL),
  });

  // Try to read contract addresses from a known deployment
  // These are the addresses from TestWorkflow.s.sol on a fresh Anvil
  // In a real setup, you'd read these from a deployment file
  console.log('Looking for deployed contracts...');
  console.log('');
  console.log('NOTE: This script works best after running:');
  console.log('  forge script script/TestWorkflow.s.sol --rpc-url http://localhost:8545 --broadcast');
  console.log('');
  console.log('The TestWorkflow script will:');
  console.log('  1. Deploy all contracts');
  console.log('  2. Have LP deposit 100,000 USDC');
  console.log('  3. Create a 10,000 USDC invoice at 5% APR');
  console.log('  4. Fund the invoice (supplier gets ~9,959 USDC)');
  console.log('  5. Warp 30 days forward');
  console.log('  6. Process repayment (buyer pays 10,000 USDC)');
  console.log('  7. Show yield accrual (~41 USDC profit)');
  console.log('');

  printSeparator('HOW TO TEST YIELD ACCRUAL');

  console.log('Option 1: Run the full TestWorkflow (recommended)');
  console.log('----------------------------------------------------------');
  console.log('  # Start Anvil');
  console.log('  anvil --host 0.0.0.0');
  console.log('');
  console.log('  # Run full workflow with time warp');
  console.log('  forge script script/TestWorkflow.s.sol --rpc-url http://localhost:8545 --broadcast');
  console.log('');

  console.log('Option 2: Manual time manipulation');
  console.log('----------------------------------------------------------');
  console.log('  # After deploying contracts and funding invoices:');
  console.log('');
  console.log('  # Advance time 30 days');
  console.log('  npx ts-node backend/scripts/advanceTime.ts 30');
  console.log('');
  console.log('  # Or using cast directly:');
  console.log('  cast rpc evm_increaseTime 2592000 --rpc-url http://localhost:8545');
  console.log('  cast rpc evm_mine --rpc-url http://localhost:8545');
  console.log('');

  console.log('Option 3: Use the Foundry simulation script');
  console.log('----------------------------------------------------------');
  console.log('  # Calculate expected yield for an invoice');
  console.log('  forge script script/SimulateYieldAccrual.s.sol \\');
  console.log('    --sig "calculateInvoiceYield(uint256,uint256,uint256)" \\');
  console.log('    10000000000 500 30');
  console.log('');
  console.log('  # View pool state (requires pool address)');
  console.log('  forge script script/SimulateYieldAccrual.s.sol \\');
  console.log('    --rpc-url http://localhost:8545 \\');
  console.log('    --sig "viewState(address)" <POOL_ADDRESS>');
  console.log('');

  printSeparator('YIELD CALCULATION EXAMPLE');

  // Calculate expected yield for a sample invoice
  const faceValue = 10_000n * 1_000_000n; // 10,000 USDC
  const discountRateBps = 500n; // 5% APR
  const daysToMaturity = 30n;
  const secondsToMaturity = daysToMaturity * 24n * 60n * 60n;

  const annualDiscount = (faceValue * discountRateBps) / 10000n;
  const discount = (annualDiscount * secondsToMaturity) / (365n * 24n * 60n * 60n);
  const fundingAmount = faceValue - discount;

  console.log('Sample Invoice:');
  console.log(`  Face Value:       ${formatUsdc(faceValue)} USDC`);
  console.log(`  Discount Rate:    ${discountRateBps} bps (5% APR)`);
  console.log(`  Days to Maturity: ${daysToMaturity}`);
  console.log('');
  console.log('Calculated Values:');
  console.log(`  Funding Amount:   ${formatUsdc(fundingAmount)} USDC (sent to supplier)`);
  console.log(`  Discount/Yield:   ${formatUsdc(discount)} USDC (protocol profit)`);
  console.log('');
  console.log('This means:');
  console.log(`  - Supplier receives ${formatUsdc(fundingAmount)} USDC immediately`);
  console.log(`  - Buyer pays ${formatUsdc(faceValue)} USDC at maturity`);
  console.log(`  - LPs earn ${formatUsdc(discount)} USDC in yield`);
  console.log(`  - Share price increases proportionally`);
  console.log('');

  printSeparator('BACKEND TIME PROVIDER');

  console.log('The backend now supports blockchain time synchronization:');
  console.log('');
  console.log('  // In your backend code:');
  console.log('  import { timeProvider } from "./lib/timeProvider";');
  console.log('');
  console.log('  // For local testing with Anvil:');
  console.log('  timeProvider.useBlockchainTime("http://localhost:8545");');
  console.log('');
  console.log('  // Get current time (fetches from blockchain):');
  console.log('  const now = await timeProvider.now();');
  console.log('');
  console.log('  // After advancing Anvil time, clear cache:');
  console.log('  timeProvider.clearCache();');
  console.log('');
  console.log('  // For production, use system time:');
  console.log('  timeProvider.useSystemTime();');
  console.log('');

  // Show current blockchain time
  const currentTime = await timeProvider.now();
  console.log(`Current blockchain time: ${currentTime.toISOString()}`);
  console.log('');
}

// ============ Entry Point ============

async function main(): Promise<void> {
  try {
    await runSimulation();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
