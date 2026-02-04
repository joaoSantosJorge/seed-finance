/**
 * User Indexer Service
 *
 * Tracks per-user position data including:
 * - Deposit and withdrawal history
 * - Cost basis calculation (FIFO method)
 * - Realized and unrealized gains
 *
 * This service processes events from the PoolIndexer and maintains
 * user-specific position tracking.
 */

import { formatUnits } from 'viem';
import type {
  UserTransaction,
  UserPositionHistory,
  DepositEvent,
  WithdrawEvent,
  SharePriceSnapshot,
} from '../../types';

// ============ User Position Tracker ============

interface ShareLot {
  shares: bigint;
  costPerShare: bigint; // In USDC units (6 decimals)
  timestamp: Date;
}

export class UserPositionTracker {
  private positions: Map<string, UserPositionState> = new Map();

  // Storage callbacks
  private onTransactionSaved?: (tx: UserTransaction) => Promise<void>;
  private onPositionUpdated?: (position: UserPositionHistory) => Promise<void>;

  setStorageCallbacks(callbacks: {
    onTransactionSaved?: (tx: UserTransaction) => Promise<void>;
    onPositionUpdated?: (position: UserPositionHistory) => Promise<void>;
  }): void {
    this.onTransactionSaved = callbacks.onTransactionSaved;
    this.onPositionUpdated = callbacks.onPositionUpdated;
  }

  // ============ Event Handlers ============

  async handleDeposit(event: DepositEvent, sharePrice: bigint): Promise<void> {
    const address = event.owner.toLowerCase();
    let state = this.positions.get(address);

    if (!state) {
      state = this.createInitialState(address);
      this.positions.set(address, state);
    }

    // Add to share lots (for FIFO cost basis)
    state.shareLots.push({
      shares: event.shares,
      costPerShare: sharePrice,
      timestamp: new Date(),
    });

    // Update totals
    state.totalDeposited += event.assets;
    state.transactionCount++;
    state.lastActivityAt = new Date();

    // Save transaction
    const tx: UserTransaction = {
      id: 0,
      userAddress: address,
      txHash: event.transactionHash,
      eventType: 'deposit',
      assets: event.assets,
      shares: event.shares,
      sharePriceAtTime: sharePrice,
      blockNumber: event.blockNumber,
      timestamp: new Date(),
    };

    await this.onTransactionSaved?.(tx);
    await this.savePosition(address, state);

    console.log(
      `[UserIndexer] ${address.slice(0, 8)}... deposited ${formatUnits(event.assets, 6)} USDC`
    );
  }

  async handleWithdraw(event: WithdrawEvent, sharePrice: bigint): Promise<void> {
    const address = event.owner.toLowerCase();
    let state = this.positions.get(address);

    if (!state) {
      state = this.createInitialState(address);
      this.positions.set(address, state);
    }

    // Calculate realized gain using FIFO
    const { costBasis, realizedGain } = this.calculateFIFO(state, event.shares, event.assets);

    // Update totals
    state.totalWithdrawn += event.assets;
    state.realizedGain += realizedGain;
    state.transactionCount++;
    state.lastActivityAt = new Date();

    // Save transaction
    const tx: UserTransaction = {
      id: 0,
      userAddress: address,
      txHash: event.transactionHash,
      eventType: 'withdraw',
      assets: event.assets,
      shares: event.shares,
      sharePriceAtTime: sharePrice,
      blockNumber: event.blockNumber,
      timestamp: new Date(),
    };

    await this.onTransactionSaved?.(tx);
    await this.savePosition(address, state);

    console.log(
      `[UserIndexer] ${address.slice(0, 8)}... withdrew ${formatUnits(event.assets, 6)} USDC (gain: ${formatUnits(realizedGain, 6)})`
    );
  }

  // ============ FIFO Cost Basis Calculation ============

  private calculateFIFO(
    state: UserPositionState,
    sharesToSell: bigint,
    assetsReceived: bigint
  ): { costBasis: bigint; realizedGain: bigint } {
    let remainingShares = sharesToSell;
    let totalCostBasis = 0n;

    // Process lots in FIFO order
    while (remainingShares > 0n && state.shareLots.length > 0) {
      const lot = state.shareLots[0];

      if (lot.shares <= remainingShares) {
        // Use entire lot
        totalCostBasis += lot.shares * lot.costPerShare / (10n ** 6n); // Normalize
        remainingShares -= lot.shares;
        state.shareLots.shift(); // Remove depleted lot
      } else {
        // Partial use of lot
        totalCostBasis += remainingShares * lot.costPerShare / (10n ** 6n);
        lot.shares -= remainingShares;
        remainingShares = 0n;
      }
    }

    const realizedGain = assetsReceived - totalCostBasis;
    return { costBasis: totalCostBasis, realizedGain };
  }

  // ============ Position Queries ============

  getPosition(address: string): UserPositionHistory | null {
    const state = this.positions.get(address.toLowerCase());
    if (!state) return null;

    // Calculate current cost basis from remaining lots
    const currentCostBasis = state.shareLots.reduce((sum, lot) => {
      return sum + (lot.shares * lot.costPerShare) / (10n ** 6n);
    }, 0n);

    return {
      userAddress: state.address,
      totalDeposited: state.totalDeposited,
      totalWithdrawn: state.totalWithdrawn,
      costBasis: currentCostBasis,
      realizedGain: state.realizedGain,
      firstDepositAt: state.firstDepositAt,
      lastActivityAt: state.lastActivityAt,
      transactionCount: state.transactionCount,
    };
  }

  calculateUnrealizedGain(address: string, currentSharePrice: bigint): bigint {
    const state = this.positions.get(address.toLowerCase());
    if (!state || state.shareLots.length === 0) return 0n;

    // Sum current value of all lots
    const currentValue = state.shareLots.reduce((sum, lot) => {
      return sum + (lot.shares * currentSharePrice) / (10n ** 6n);
    }, 0n);

    // Sum cost basis of all lots
    const costBasis = state.shareLots.reduce((sum, lot) => {
      return sum + (lot.shares * lot.costPerShare) / (10n ** 6n);
    }, 0n);

    return currentValue - costBasis;
  }

  getTotalShares(address: string): bigint {
    const state = this.positions.get(address.toLowerCase());
    if (!state) return 0n;

    return state.shareLots.reduce((sum, lot) => sum + lot.shares, 0n);
  }

  // ============ Persistence ============

  async loadPosition(position: UserPositionHistory, shareLots: ShareLot[]): Promise<void> {
    const state: UserPositionState = {
      address: position.userAddress,
      shareLots,
      totalDeposited: position.totalDeposited,
      totalWithdrawn: position.totalWithdrawn,
      realizedGain: position.realizedGain,
      firstDepositAt: position.firstDepositAt,
      lastActivityAt: position.lastActivityAt,
      transactionCount: position.transactionCount,
    };
    this.positions.set(position.userAddress.toLowerCase(), state);
  }

  private async savePosition(address: string, state: UserPositionState): Promise<void> {
    const position = this.getPosition(address);
    if (position) {
      await this.onPositionUpdated?.(position);
    }
  }

  // ============ Helpers ============

  private createInitialState(address: string): UserPositionState {
    return {
      address: address.toLowerCase(),
      shareLots: [],
      totalDeposited: 0n,
      totalWithdrawn: 0n,
      realizedGain: 0n,
      firstDepositAt: new Date(),
      lastActivityAt: new Date(),
      transactionCount: 0,
    };
  }

  getAllUsers(): string[] {
    return Array.from(this.positions.keys());
  }
}

// ============ Types ============

interface UserPositionState {
  address: string;
  shareLots: ShareLot[];
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  realizedGain: bigint;
  firstDepositAt: Date;
  lastActivityAt: Date;
  transactionCount: number;
}

// ============ Factory ============

export function createUserPositionTracker(): UserPositionTracker {
  return new UserPositionTracker();
}
