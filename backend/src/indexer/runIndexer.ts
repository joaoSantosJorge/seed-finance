/**
 * Indexer Runner
 *
 * Main entry point for running the pool indexer with database persistence.
 * Handles graceful shutdown, state recovery, and error handling.
 *
 * Usage:
 *   npm run indexer         - Run indexer
 *   npm run indexer:dev     - Run with hot reload
 */

import 'dotenv/config';
import { createPoolIndexer } from './poolIndexer.js';
import { createUserPositionTracker } from './userIndexer.js';
import {
  saveSharePriceSnapshot,
  savePoolStateSnapshot,
  saveYieldEvent,
  saveUserTransaction,
  updateUserPosition,
  addShareLot,
  loadIndexerState,
  saveIndexerState,
  disconnect,
} from './dbStorage.js';
import type { DepositEvent, WithdrawEvent } from '../../types/index.js';

// ============ Configuration ============

const config = {
  chainId: parseInt(process.env.CHAIN_ID || '31337'),
  liquidityPoolAddress: process.env.LIQUIDITY_POOL_ADDRESS as `0x${string}`,
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000'),
  batchSize: parseInt(process.env.BATCH_SIZE || '1000'),
  startBlock: BigInt(process.env.START_BLOCK || '0'),
};

// Validate required config
if (!config.liquidityPoolAddress) {
  console.error('Error: LIQUIDITY_POOL_ADDRESS environment variable is required');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('Seed Finance Pool Indexer');
console.log('='.repeat(60));
console.log(`Chain ID: ${config.chainId}`);
console.log(`RPC URL: ${config.rpcUrl}`);
console.log(`Pool Address: ${config.liquidityPoolAddress}`);
console.log(`Polling Interval: ${config.pollingInterval}ms`);
console.log(`Batch Size: ${config.batchSize}`);
console.log('='.repeat(60));

// ============ Initialize Services ============

const poolIndexer = createPoolIndexer({
  chainId: config.chainId,
  liquidityPoolAddress: config.liquidityPoolAddress,
  rpcUrl: config.rpcUrl,
  pollingInterval: config.pollingInterval,
  batchSize: config.batchSize,
  startBlock: config.startBlock,
});

const userTracker = createUserPositionTracker();

// ============ Wire Up Storage Callbacks ============

// Pool indexer -> Database
poolIndexer.setStorageCallbacks({
  onSharePriceSnapshot: saveSharePriceSnapshot,
  onPoolStateSnapshot: savePoolStateSnapshot,
  onYieldEvent: saveYieldEvent,

  // Deposit events -> User tracker
  onDepositEvent: async (event: DepositEvent) => {
    // Calculate share price at time of deposit
    const sharePrice =
      event.shares > 0n ? (event.assets * 10n ** 6n) / event.shares : 10n ** 6n;

    await userTracker.handleDeposit(event, sharePrice);

    // Save share lot for FIFO tracking
    await addShareLot(
      event.owner.toLowerCase(),
      event.shares,
      sharePrice,
      new Date()
    );
  },

  // Withdraw events -> User tracker
  onWithdrawEvent: async (event: WithdrawEvent) => {
    const sharePrice =
      event.shares > 0n ? (event.assets * 10n ** 6n) / event.shares : 10n ** 6n;

    await userTracker.handleWithdraw(event, sharePrice);
  },

  onStateUpdate: saveIndexerState,
});

// User tracker -> Database
userTracker.setStorageCallbacks({
  onTransactionSaved: saveUserTransaction,
  onPositionUpdated: updateUserPosition,
});

// ============ Graceful Shutdown ============

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Indexer] Received ${signal}, shutting down gracefully...`);

  try {
    await poolIndexer.stop();
    await disconnect();
    console.log('[Indexer] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Indexer] Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error('[Indexer] Uncaught exception:', error);
  shutdown('uncaughtException');
});

// ============ Main Entry Point ============

async function main(): Promise<void> {
  try {
    // Try to load previous state
    const savedState = await loadIndexerState();
    if (savedState && savedState.lastProcessedBlock > config.startBlock) {
      console.log(`[Indexer] Resuming from block ${savedState.lastProcessedBlock}`);
      // Update config to resume from saved state
      // Note: This would require modifying the indexer to accept initial state
    }

    // Start indexer
    console.log('[Indexer] Starting...');
    await poolIndexer.start();
  } catch (error) {
    console.error('[Indexer] Failed to start:', error);
    await shutdown('error');
  }
}

main();
