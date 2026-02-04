/**
 * Pool Indexer Service
 *
 * Indexes LiquidityPool events to track:
 * - Share price history
 * - User deposit/withdraw transactions
 * - Yield events (invoice and treasury)
 *
 * This service polls for new blocks and processes relevant events,
 * storing snapshots in the database for historical queries.
 */

import { createPublicClient, http, parseAbiItem, type Log, formatUnits } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type {
  SharePriceSnapshot,
  YieldEvent,
  PoolStateSnapshot,
  DepositEvent,
  WithdrawEvent,
  LiquidityReturnedEvent,
  TreasuryYieldAccruedEvent,
  IndexerState,
} from '../../types';

// ============ Configuration ============

interface PoolIndexerConfig {
  chainId: number;
  liquidityPoolAddress: `0x${string}`;
  rpcUrl: string;
  pollingInterval?: number; // ms between polls
  batchSize?: number; // blocks per query
  startBlock?: bigint; // block to start indexing from
}

// ============ Event Signatures ============

const DEPOSIT_EVENT = parseAbiItem(
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)'
);

const WITHDRAW_EVENT = parseAbiItem(
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)'
);

const LIQUIDITY_RETURNED_EVENT = parseAbiItem(
  'event LiquidityReturned(uint256 indexed invoiceId, uint256 principal, uint256 yield)'
);

const TREASURY_YIELD_EVENT = parseAbiItem(
  'event TreasuryYieldAccrued(uint256 amount, uint256 newTotalTreasuryYield)'
);

// ============ Pool Indexer Class ============

export class PoolIndexer {
  private client: ReturnType<typeof createPublicClient>;
  private config: Required<PoolIndexerConfig>;
  private state: IndexerState;
  private isRunning: boolean = false;
  private pollTimeout: NodeJS.Timeout | null = null;

  // Storage callbacks - to be implemented by database layer
  private onSharePriceSnapshot?: (snapshot: SharePriceSnapshot) => Promise<void>;
  private onDepositEvent?: (event: DepositEvent) => Promise<void>;
  private onWithdrawEvent?: (event: WithdrawEvent) => Promise<void>;
  private onYieldEvent?: (event: YieldEvent) => Promise<void>;
  private onPoolStateSnapshot?: (snapshot: PoolStateSnapshot) => Promise<void>;
  private onStateUpdate?: (state: IndexerState) => Promise<void>;

  constructor(config: PoolIndexerConfig) {
    const chain = config.chainId === 8453 ? base : baseSepolia;

    this.config = {
      pollingInterval: 15000, // 15 seconds
      batchSize: 1000,
      startBlock: 0n,
      ...config,
    };

    this.client = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });

    this.state = {
      lastProcessedBlock: this.config.startBlock,
      lastProcessedTimestamp: new Date(),
      isRunning: false,
      errorCount: 0,
    };
  }

  // ============ Storage Callbacks ============

  setStorageCallbacks(callbacks: {
    onSharePriceSnapshot?: (snapshot: SharePriceSnapshot) => Promise<void>;
    onDepositEvent?: (event: DepositEvent) => Promise<void>;
    onWithdrawEvent?: (event: WithdrawEvent) => Promise<void>;
    onYieldEvent?: (event: YieldEvent) => Promise<void>;
    onPoolStateSnapshot?: (snapshot: PoolStateSnapshot) => Promise<void>;
    onStateUpdate?: (state: IndexerState) => Promise<void>;
  }): void {
    this.onSharePriceSnapshot = callbacks.onSharePriceSnapshot;
    this.onDepositEvent = callbacks.onDepositEvent;
    this.onWithdrawEvent = callbacks.onWithdrawEvent;
    this.onYieldEvent = callbacks.onYieldEvent;
    this.onPoolStateSnapshot = callbacks.onPoolStateSnapshot;
    this.onStateUpdate = callbacks.onStateUpdate;
  }

  // ============ Lifecycle ============

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[PoolIndexer] Already running');
      return;
    }

    console.log('[PoolIndexer] Starting indexer...');
    this.isRunning = true;
    this.state.isRunning = true;

    // Start polling loop
    await this.poll();
  }

  async stop(): Promise<void> {
    console.log('[PoolIndexer] Stopping indexer...');
    this.isRunning = false;
    this.state.isRunning = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    await this.onStateUpdate?.(this.state);
  }

  // ============ Main Polling Loop ============

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const currentBlock = await this.client.getBlockNumber();
      const fromBlock = this.state.lastProcessedBlock + 1n;
      const toBlock =
        currentBlock - fromBlock > BigInt(this.config.batchSize)
          ? fromBlock + BigInt(this.config.batchSize)
          : currentBlock;

      if (fromBlock <= toBlock) {
        console.log(`[PoolIndexer] Processing blocks ${fromBlock} to ${toBlock}`);
        await this.processBlockRange(fromBlock, toBlock);

        this.state.lastProcessedBlock = toBlock;
        this.state.lastProcessedTimestamp = new Date();
        this.state.errorCount = 0;
        await this.onStateUpdate?.(this.state);
      }
    } catch (error) {
      this.state.errorCount++;
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PoolIndexer] Error:', this.state.lastError);
      await this.onStateUpdate?.(this.state);
    }

    // Schedule next poll
    if (this.isRunning) {
      this.pollTimeout = setTimeout(() => this.poll(), this.config.pollingInterval);
    }
  }

  // ============ Block Processing ============

  private async processBlockRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
    // Fetch all events in parallel
    const [depositLogs, withdrawLogs, liquidityReturnedLogs, treasuryYieldLogs] =
      await Promise.all([
        this.client.getLogs({
          address: this.config.liquidityPoolAddress,
          event: DEPOSIT_EVENT,
          fromBlock,
          toBlock,
        }),
        this.client.getLogs({
          address: this.config.liquidityPoolAddress,
          event: WITHDRAW_EVENT,
          fromBlock,
          toBlock,
        }),
        this.client.getLogs({
          address: this.config.liquidityPoolAddress,
          event: LIQUIDITY_RETURNED_EVENT,
          fromBlock,
          toBlock,
        }),
        this.client.getLogs({
          address: this.config.liquidityPoolAddress,
          event: TREASURY_YIELD_EVENT,
          fromBlock,
          toBlock,
        }),
      ]);

    // Process deposit events
    for (const log of depositLogs) {
      await this.processDepositEvent(log);
    }

    // Process withdraw events
    for (const log of withdrawLogs) {
      await this.processWithdrawEvent(log);
    }

    // Process yield events
    for (const log of liquidityReturnedLogs) {
      await this.processLiquidityReturnedEvent(log);
    }

    for (const log of treasuryYieldLogs) {
      await this.processTreasuryYieldEvent(log);
    }

    // Take a pool state snapshot at the end of the range
    // (only if there were any events or at regular intervals)
    const hasEvents =
      depositLogs.length > 0 ||
      withdrawLogs.length > 0 ||
      liquidityReturnedLogs.length > 0 ||
      treasuryYieldLogs.length > 0;

    if (hasEvents) {
      await this.takePoolSnapshot(toBlock);
    }
  }

  // ============ Event Processors ============

  private async processDepositEvent(log: Log<bigint, number, false, typeof DEPOSIT_EVENT>): Promise<void> {
    if (!log.args.sender || !log.args.owner || log.args.assets === undefined || log.args.shares === undefined) {
      return;
    }

    const event: DepositEvent = {
      sender: log.args.sender,
      owner: log.args.owner,
      assets: log.args.assets,
      shares: log.args.shares,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? '0x',
      logIndex: log.logIndex ?? 0,
    };

    console.log(`[PoolIndexer] Deposit: ${formatUnits(event.assets, 6)} USDC -> ${formatUnits(event.shares, 6)} SEED`);
    await this.onDepositEvent?.(event);

    // Take share price snapshot after deposit
    await this.takeSharePriceSnapshot(log.blockNumber ?? 0n);
  }

  private async processWithdrawEvent(log: Log<bigint, number, false, typeof WITHDRAW_EVENT>): Promise<void> {
    if (
      !log.args.sender ||
      !log.args.receiver ||
      !log.args.owner ||
      log.args.assets === undefined ||
      log.args.shares === undefined
    ) {
      return;
    }

    const event: WithdrawEvent = {
      sender: log.args.sender,
      receiver: log.args.receiver,
      owner: log.args.owner,
      assets: log.args.assets,
      shares: log.args.shares,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? '0x',
      logIndex: log.logIndex ?? 0,
    };

    console.log(
      `[PoolIndexer] Withdraw: ${formatUnits(event.shares, 6)} SEED -> ${formatUnits(event.assets, 6)} USDC`
    );
    await this.onWithdrawEvent?.(event);

    // Take share price snapshot after withdraw
    await this.takeSharePriceSnapshot(log.blockNumber ?? 0n);
  }

  private async processLiquidityReturnedEvent(
    log: Log<bigint, number, false, typeof LIQUIDITY_RETURNED_EVENT>
  ): Promise<void> {
    if (
      log.args.invoiceId === undefined ||
      log.args.principal === undefined ||
      log.args.yield === undefined
    ) {
      return;
    }

    const event: YieldEvent = {
      id: 0, // Will be assigned by database
      eventType: 'invoice',
      invoiceId: log.args.invoiceId,
      principal: log.args.principal,
      yieldAmount: log.args.yield,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? '0x',
      timestamp: new Date(),
    };

    console.log(
      `[PoolIndexer] Invoice yield: ${formatUnits(event.yieldAmount, 6)} USDC from invoice #${event.invoiceId}`
    );
    await this.onYieldEvent?.(event);

    // Take share price snapshot after yield event
    await this.takeSharePriceSnapshot(log.blockNumber ?? 0n);
  }

  private async processTreasuryYieldEvent(
    log: Log<bigint, number, false, typeof TREASURY_YIELD_EVENT>
  ): Promise<void> {
    if (log.args.amount === undefined) {
      return;
    }

    const event: YieldEvent = {
      id: 0,
      eventType: 'treasury',
      yieldAmount: log.args.amount,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? '0x',
      timestamp: new Date(),
    };

    console.log(`[PoolIndexer] Treasury yield: ${formatUnits(event.yieldAmount, 6)} USDC`);
    await this.onYieldEvent?.(event);

    // Take share price snapshot after yield event
    await this.takeSharePriceSnapshot(log.blockNumber ?? 0n);
  }

  // ============ Snapshot Functions ============

  private async takeSharePriceSnapshot(blockNumber: bigint): Promise<void> {
    try {
      // Read current pool state from contract
      const [totalAssets, totalSupply] = await Promise.all([
        this.client.readContract({
          address: this.config.liquidityPoolAddress,
          abi: [
            {
              name: 'totalAssets',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'totalAssets',
          blockNumber,
        }),
        this.client.readContract({
          address: this.config.liquidityPoolAddress,
          abi: [
            {
              name: 'totalSupply',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint256' }],
            },
          ],
          functionName: 'totalSupply',
          blockNumber,
        }),
      ]);

      // Calculate share price (value of 1e6 shares)
      const oneShare = 10n ** 6n;
      const sharePrice = totalSupply > 0n ? (oneShare * totalAssets) / totalSupply : oneShare;

      const block = await this.client.getBlock({ blockNumber });

      const snapshot: SharePriceSnapshot = {
        id: 0, // Will be assigned by database
        blockNumber,
        timestamp: new Date(Number(block.timestamp) * 1000),
        totalAssets,
        totalSupply,
        sharePrice,
      };

      await this.onSharePriceSnapshot?.(snapshot);
    } catch (error) {
      console.error('[PoolIndexer] Failed to take share price snapshot:', error);
    }
  }

  private async takePoolSnapshot(blockNumber: bigint): Promise<void> {
    try {
      const abi = [
        { name: 'totalAssets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'totalDeployed', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'totalInTreasury', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'availableLiquidity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'utilizationRate', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'totalInvoiceYield', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
        { name: 'totalTreasuryYield', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      ];

      const [
        totalAssets,
        totalSupply,
        totalDeployed,
        totalInTreasury,
        availableLiquidity,
        utilizationRate,
        totalInvoiceYield,
        totalTreasuryYield,
      ] = await Promise.all([
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'totalAssets', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'totalSupply', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'totalDeployed', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'totalInTreasury', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'availableLiquidity', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'utilizationRate', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'totalInvoiceYield', blockNumber }),
        this.client.readContract({ address: this.config.liquidityPoolAddress, abi, functionName: 'totalTreasuryYield', blockNumber }),
      ]);

      const block = await this.client.getBlock({ blockNumber });

      const snapshot: PoolStateSnapshot = {
        id: 0,
        blockNumber,
        timestamp: new Date(Number(block.timestamp) * 1000),
        totalAssets: totalAssets as bigint,
        totalSupply: totalSupply as bigint,
        totalDeployed: totalDeployed as bigint,
        totalInTreasury: totalInTreasury as bigint,
        availableLiquidity: availableLiquidity as bigint,
        utilizationRate: Number(utilizationRate),
        activeInvoices: 0, // Would need to query ExecutionPool
        totalInvoiceYield: totalInvoiceYield as bigint,
        totalTreasuryYield: totalTreasuryYield as bigint,
      };

      await this.onPoolStateSnapshot?.(snapshot);
    } catch (error) {
      console.error('[PoolIndexer] Failed to take pool snapshot:', error);
    }
  }

  // ============ Utility Methods ============

  getState(): IndexerState {
    return { ...this.state };
  }

  async backfill(fromBlock: bigint, toBlock: bigint): Promise<void> {
    console.log(`[PoolIndexer] Backfilling from block ${fromBlock} to ${toBlock}`);

    let currentBlock = fromBlock;
    while (currentBlock <= toBlock) {
      const endBlock =
        toBlock - currentBlock > BigInt(this.config.batchSize)
          ? currentBlock + BigInt(this.config.batchSize)
          : toBlock;

      await this.processBlockRange(currentBlock, endBlock);
      currentBlock = endBlock + 1n;

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('[PoolIndexer] Backfill complete');
  }
}

// ============ Factory Function ============

export function createPoolIndexer(config: PoolIndexerConfig): PoolIndexer {
  return new PoolIndexer(config);
}
