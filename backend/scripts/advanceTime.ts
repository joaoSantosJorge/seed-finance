#!/usr/bin/env npx ts-node
/**
 * Anvil Time Manipulation Script
 *
 * Advances time on a local Anvil instance for testing time-dependent features.
 * After advancing time, clears the time provider cache so subsequent reads
 * reflect the new blockchain time.
 *
 * Usage:
 *   npx ts-node backend/scripts/advanceTime.ts <days>
 *   npx ts-node backend/scripts/advanceTime.ts 30         # Advance 30 days
 *   npx ts-node backend/scripts/advanceTime.ts 1 --hours  # Advance 1 hour
 *   npx ts-node backend/scripts/advanceTime.ts 30 --mine 10  # Advance 30 days and mine 10 blocks
 *
 * Environment:
 *   RPC_URL - Anvil RPC URL (default: http://127.0.0.1:8545)
 */

import { createTestClient, createPublicClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { timeProvider } from '../lib/timeProvider';

// ============ Configuration ============

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

// ============ Parse Arguments ============

interface AdvanceOptions {
  amount: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
  blocksToMine: number;
  showStatus: boolean;
}

function parseArgs(): AdvanceOptions {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Anvil Time Manipulation Script

Usage:
  npx ts-node backend/scripts/advanceTime.ts <amount> [options]

Arguments:
  amount          Number of time units to advance

Options:
  --seconds       Advance by seconds (default: days)
  --minutes       Advance by minutes
  --hours         Advance by hours
  --days          Advance by days (default)
  --mine <n>      Mine n additional blocks after time advance (default: 1)
  --status        Show detailed pool status after advancing
  --help, -h      Show this help message

Examples:
  npx ts-node backend/scripts/advanceTime.ts 30           # Advance 30 days
  npx ts-node backend/scripts/advanceTime.ts 1 --hours    # Advance 1 hour
  npx ts-node backend/scripts/advanceTime.ts 7 --mine 5   # Advance 7 days, mine 5 blocks
  npx ts-node backend/scripts/advanceTime.ts 30 --status  # Advance and show pool status

Environment:
  RPC_URL         Anvil RPC URL (default: http://127.0.0.1:8545)
`);
    process.exit(0);
  }

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount <= 0) {
    console.error('Error: First argument must be a positive number');
    process.exit(1);
  }

  let unit: AdvanceOptions['unit'] = 'days';
  if (args.includes('--seconds')) unit = 'seconds';
  else if (args.includes('--minutes')) unit = 'minutes';
  else if (args.includes('--hours')) unit = 'hours';
  else if (args.includes('--days')) unit = 'days';

  let blocksToMine = 1;
  const mineIndex = args.indexOf('--mine');
  if (mineIndex !== -1 && args[mineIndex + 1]) {
    blocksToMine = parseInt(args[mineIndex + 1]) || 1;
  }

  const showStatus = args.includes('--status');

  return { amount, unit, blocksToMine, showStatus };
}

// ============ Main Functions ============

async function advanceTime(options: AdvanceOptions): Promise<void> {
  const { amount, unit, blocksToMine } = options;

  // Calculate seconds to advance
  let seconds: number;
  switch (unit) {
    case 'seconds':
      seconds = amount;
      break;
    case 'minutes':
      seconds = amount * SECONDS_PER_MINUTE;
      break;
    case 'hours':
      seconds = amount * SECONDS_PER_HOUR;
      break;
    case 'days':
    default:
      seconds = amount * SECONDS_PER_DAY;
      break;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  ANVIL TIME MANIPULATION');
  console.log('='.repeat(60));
  console.log('');

  // Create clients
  const testClient = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
  });

  // Get current state
  const blockBefore = await publicClient.getBlock();
  const timeBefore = new Date(Number(blockBefore.timestamp) * 1000);

  console.log('Before:');
  console.log(`  Block Number: ${blockBefore.number}`);
  console.log(`  Block Time:   ${timeBefore.toISOString()}`);
  console.log(`  Unix Time:    ${blockBefore.timestamp}`);
  console.log('');

  // Advance time
  console.log(`Advancing time by ${amount} ${unit} (${seconds.toLocaleString()} seconds)...`);
  await testClient.increaseTime({ seconds });

  // Mine blocks
  console.log(`Mining ${blocksToMine} block(s)...`);
  await testClient.mine({ blocks: blocksToMine });

  // Clear time provider cache
  timeProvider.clearCache();

  // Get new state
  const blockAfter = await publicClient.getBlock();
  const timeAfter = new Date(Number(blockAfter.timestamp) * 1000);

  console.log('');
  console.log('After:');
  console.log(`  Block Number: ${blockAfter.number}`);
  console.log(`  Block Time:   ${timeAfter.toISOString()}`);
  console.log(`  Unix Time:    ${blockAfter.timestamp}`);
  console.log('');

  // Calculate actual advance
  const actualAdvance = Number(blockAfter.timestamp) - Number(blockBefore.timestamp);
  const daysAdvanced = actualAdvance / SECONDS_PER_DAY;

  console.log('Summary:');
  console.log(`  Time Advanced: ${actualAdvance.toLocaleString()} seconds`);
  console.log(`  Days Advanced: ${daysAdvanced.toFixed(2)}`);
  console.log(`  Blocks Mined:  ${Number(blockAfter.number) - Number(blockBefore.number)}`);
  console.log('');
}

async function showPoolStatus(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  POOL STATUS (requires deployed contracts)');
  console.log('='.repeat(60));
  console.log('');

  // This would read from deployed contracts
  // For now, just show that the feature is available
  console.log('To view pool status, ensure contracts are deployed and use:');
  console.log('  forge script script/SimulateYieldAccrual.s.sol --rpc-url $RPC_URL');
  console.log('');
}

// ============ Entry Point ============

async function main(): Promise<void> {
  try {
    const options = parseArgs();

    await advanceTime(options);

    if (options.showStatus) {
      await showPoolStatus();
    }

    console.log('='.repeat(60));
    console.log('  TIME ADVANCE COMPLETE');
    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
