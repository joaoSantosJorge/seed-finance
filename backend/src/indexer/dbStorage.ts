/**
 * Database Storage Layer for Indexer
 *
 * Provides callback implementations that persist indexer events to PostgreSQL
 * via Prisma. This bridges the PoolIndexer and UserPositionTracker to the database.
 */

import { PrismaClient } from '@prisma/client';
import type {
  SharePriceSnapshot,
  PoolStateSnapshot,
  YieldEvent,
  DepositEvent,
  WithdrawEvent,
  UserTransaction,
  UserPositionHistory,
  IndexerState,
} from '../../types';

// ============ Prisma Client ============

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// ============ Pool Indexer Storage Callbacks ============

export async function saveSharePriceSnapshot(snapshot: SharePriceSnapshot): Promise<void> {
  try {
    await prisma.sharePriceSnapshot.upsert({
      where: { blockNumber: snapshot.blockNumber },
      update: {
        timestamp: snapshot.timestamp,
        totalAssets: snapshot.totalAssets,
        totalSupply: snapshot.totalSupply,
        sharePrice: snapshot.sharePrice,
      },
      create: {
        blockNumber: snapshot.blockNumber,
        timestamp: snapshot.timestamp,
        totalAssets: snapshot.totalAssets,
        totalSupply: snapshot.totalSupply,
        sharePrice: snapshot.sharePrice,
      },
    });
    console.log(`[DB] Saved share price snapshot at block ${snapshot.blockNumber}`);
  } catch (error) {
    console.error('[DB] Failed to save share price snapshot:', error);
    throw error;
  }
}

export async function savePoolStateSnapshot(snapshot: PoolStateSnapshot): Promise<void> {
  try {
    await prisma.poolStateSnapshot.upsert({
      where: { blockNumber: snapshot.blockNumber },
      update: {
        timestamp: snapshot.timestamp,
        totalAssets: snapshot.totalAssets,
        totalSupply: snapshot.totalSupply,
        totalDeployed: snapshot.totalDeployed,
        totalInTreasury: snapshot.totalInTreasury,
        availableLiquidity: snapshot.availableLiquidity,
        utilizationRate: snapshot.utilizationRate,
        activeInvoices: snapshot.activeInvoices,
        totalInvoiceYield: snapshot.totalInvoiceYield,
        totalTreasuryYield: snapshot.totalTreasuryYield,
      },
      create: {
        blockNumber: snapshot.blockNumber,
        timestamp: snapshot.timestamp,
        totalAssets: snapshot.totalAssets,
        totalSupply: snapshot.totalSupply,
        totalDeployed: snapshot.totalDeployed,
        totalInTreasury: snapshot.totalInTreasury,
        availableLiquidity: snapshot.availableLiquidity,
        utilizationRate: snapshot.utilizationRate,
        activeInvoices: snapshot.activeInvoices,
        totalInvoiceYield: snapshot.totalInvoiceYield,
        totalTreasuryYield: snapshot.totalTreasuryYield,
      },
    });
    console.log(`[DB] Saved pool state snapshot at block ${snapshot.blockNumber}`);
  } catch (error) {
    console.error('[DB] Failed to save pool state snapshot:', error);
    throw error;
  }
}

export async function saveYieldEvent(event: YieldEvent): Promise<void> {
  try {
    await prisma.yieldEvent.upsert({
      where: {
        txHash_eventType: {
          txHash: event.txHash,
          eventType: event.eventType,
        },
      },
      update: {
        invoiceId: event.invoiceId,
        principal: event.principal,
        yieldAmount: event.yieldAmount,
        timestamp: event.timestamp,
      },
      create: {
        eventType: event.eventType,
        invoiceId: event.invoiceId,
        principal: event.principal,
        yieldAmount: event.yieldAmount,
        blockNumber: event.blockNumber,
        txHash: event.txHash,
        timestamp: event.timestamp,
      },
    });
    console.log(`[DB] Saved ${event.eventType} yield event: ${event.txHash}`);
  } catch (error) {
    console.error('[DB] Failed to save yield event:', error);
    throw error;
  }
}

// ============ User Indexer Storage Callbacks ============

export async function saveUserTransaction(tx: UserTransaction): Promise<void> {
  try {
    // First ensure user position exists
    await prisma.userPosition.upsert({
      where: { userAddress: tx.userAddress },
      update: {},
      create: {
        userAddress: tx.userAddress,
        totalDeposited: 0n,
        totalWithdrawn: 0n,
        costBasis: 0n,
        realizedGain: 0n,
        firstDepositAt: tx.timestamp,
        lastActivityAt: tx.timestamp,
        transactionCount: 0,
      },
    });

    // Save transaction
    await prisma.userTransaction.upsert({
      where: {
        txHash_logIndex: {
          txHash: tx.txHash,
          logIndex: 0, // Default log index
        },
      },
      update: {
        assets: tx.assets,
        shares: tx.shares,
        sharePriceAtTime: tx.sharePriceAtTime,
        timestamp: tx.timestamp,
      },
      create: {
        userAddress: tx.userAddress,
        txHash: tx.txHash,
        eventType: tx.eventType,
        assets: tx.assets,
        shares: tx.shares,
        sharePriceAtTime: tx.sharePriceAtTime,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
      },
    });

    console.log(`[DB] Saved ${tx.eventType} for ${tx.userAddress.slice(0, 8)}...`);
  } catch (error) {
    console.error('[DB] Failed to save user transaction:', error);
    throw error;
  }
}

export async function updateUserPosition(position: UserPositionHistory): Promise<void> {
  try {
    await prisma.userPosition.update({
      where: { userAddress: position.userAddress },
      data: {
        totalDeposited: position.totalDeposited,
        totalWithdrawn: position.totalWithdrawn,
        costBasis: position.costBasis,
        realizedGain: position.realizedGain,
        lastActivityAt: position.lastActivityAt,
        transactionCount: position.transactionCount,
      },
    });
    console.log(`[DB] Updated position for ${position.userAddress.slice(0, 8)}...`);
  } catch (error) {
    console.error('[DB] Failed to update user position:', error);
    throw error;
  }
}

// ============ Share Lot Management ============

export async function addShareLot(
  userAddress: string,
  shares: bigint,
  costPerShare: bigint,
  timestamp: Date
): Promise<void> {
  try {
    await prisma.userShareLot.create({
      data: {
        userAddress,
        shares,
        costPerShare,
        timestamp,
      },
    });
    console.log(`[DB] Added share lot for ${userAddress.slice(0, 8)}...`);
  } catch (error) {
    console.error('[DB] Failed to add share lot:', error);
    throw error;
  }
}

export async function consumeShareLots(
  userAddress: string,
  sharesToConsume: bigint
): Promise<{ costBasis: bigint; realizedGain: bigint }> {
  // Fetch lots in FIFO order
  const lots = await prisma.userShareLot.findMany({
    where: { userAddress },
    orderBy: { timestamp: 'asc' },
  });

  let remaining = sharesToConsume;
  let totalCostBasis = 0n;
  const lotsToDelete: number[] = [];
  const lotsToUpdate: { id: number; shares: bigint }[] = [];

  for (const lot of lots) {
    if (remaining <= 0n) break;

    if (lot.shares <= remaining) {
      // Consume entire lot
      totalCostBasis += (lot.shares * lot.costPerShare) / 10n ** 6n;
      remaining -= lot.shares;
      lotsToDelete.push(lot.id);
    } else {
      // Partial consumption
      totalCostBasis += (remaining * lot.costPerShare) / 10n ** 6n;
      lotsToUpdate.push({ id: lot.id, shares: lot.shares - remaining });
      remaining = 0n;
    }
  }

  // Apply updates in a transaction
  await prisma.$transaction([
    ...lotsToDelete.map((id) => prisma.userShareLot.delete({ where: { id } })),
    ...lotsToUpdate.map((u) =>
      prisma.userShareLot.update({
        where: { id: u.id },
        data: { shares: u.shares },
      })
    ),
  ]);

  return { costBasis: totalCostBasis, realizedGain: 0n }; // Caller calculates realized gain
}

// ============ Indexer State Management ============

export async function loadIndexerState(indexerName: string = 'pool_indexer'): Promise<IndexerState | null> {
  try {
    const state = await prisma.indexerState.findUnique({
      where: { indexerName },
    });

    if (!state) return null;

    return {
      lastProcessedBlock: state.lastProcessedBlock,
      lastProcessedTimestamp: state.lastProcessedTime,
      isRunning: state.isRunning,
      errorCount: state.errorCount,
      lastError: state.lastError ?? undefined,
    };
  } catch (error) {
    console.error('[DB] Failed to load indexer state:', error);
    return null;
  }
}

export async function saveIndexerState(
  state: IndexerState,
  indexerName: string = 'pool_indexer'
): Promise<void> {
  try {
    await prisma.indexerState.upsert({
      where: { indexerName },
      update: {
        lastProcessedBlock: state.lastProcessedBlock,
        lastProcessedTime: state.lastProcessedTimestamp,
        isRunning: state.isRunning,
        errorCount: state.errorCount,
        lastError: state.lastError,
      },
      create: {
        indexerName,
        lastProcessedBlock: state.lastProcessedBlock,
        lastProcessedTime: state.lastProcessedTimestamp,
        isRunning: state.isRunning,
        errorCount: state.errorCount,
        lastError: state.lastError,
      },
    });
  } catch (error) {
    console.error('[DB] Failed to save indexer state:', error);
    throw error;
  }
}

// ============ Lifecycle ============

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
