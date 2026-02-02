# 04. Backend Architecture Improvements

## Executive Summary

This document identifies architectural improvements needed in the Seed Finance backend services. Focus areas include error handling, dependency injection, observability, resilience patterns, and API design.

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Dependency Injection](#dependency-injection)
3. [Error Handling Strategy](#error-handling-strategy)
4. [Resilience Patterns](#resilience-patterns)
5. [API Design Improvements](#api-design-improvements)
6. [Observability & Monitoring](#observability--monitoring)
7. [Implementation Guide](#implementation-guide)

---

## Current Architecture Analysis

### Current Structure

```
backend/
├── api/
│   └── webhooks/
│       └── circle-gateway.ts    # Webhook handlers
├── services/
│   ├── CircleWalletsService.ts  # Circle Wallets SDK wrapper
│   ├── CircleGatewayService.ts  # Circle Gateway integration
│   ├── InvoiceService.ts        # Invoice business logic
│   ├── FundingService.ts        # Funding operations
│   └── RepaymentService.ts      # Repayment processing
└── types/
    ├── invoice.ts               # Invoice types
    └── index.ts                 # Type exports
```

### Identified Issues

| Issue | Severity | Location |
|-------|----------|----------|
| No dependency injection | High | All services |
| Hardcoded service instantiation | High | Webhook handlers |
| Missing error boundaries | High | All async operations |
| No retry logic | Medium | External API calls |
| No request validation | Medium | API endpoints |
| Missing rate limiting | Medium | RPC calls |
| No circuit breaker | Medium | External dependencies |
| Incomplete logging | Low | All services |

---

## Dependency Injection

### Problem: Hardcoded Dependencies

**Current Code (`backend/api/webhooks/circle-gateway.ts`):**
```typescript
// Services instantiated at module level - untestable
const gatewayService = new CircleGatewayService({
  apiKey: process.env.CIRCLE_GATEWAY_API_KEY || '',
  webhookSecret: process.env.CIRCLE_GATEWAY_WEBHOOK_SECRET,
});

export async function POST(request: NextRequest) {
  // Uses module-level instance
  await gatewayService.processDeposit(...);
}
```

### Solution: Implement DI Container

```typescript
// backend/lib/container.ts
import { Container, interfaces } from 'inversify';
import { CircleWalletsService } from '../services/CircleWalletsService';
import { CircleGatewayService } from '../services/CircleGatewayService';
import { InvoiceService } from '../services/InvoiceService';
import { FundingService } from '../services/FundingService';
import { RepaymentService } from '../services/RepaymentService';
import { Config } from './config';

// Service identifiers
export const TYPES = {
  Config: Symbol.for('Config'),
  CircleWalletsService: Symbol.for('CircleWalletsService'),
  CircleGatewayService: Symbol.for('CircleGatewayService'),
  InvoiceService: Symbol.for('InvoiceService'),
  FundingService: Symbol.for('FundingService'),
  RepaymentService: Symbol.for('RepaymentService'),
  Logger: Symbol.for('Logger'),
  MetricsClient: Symbol.for('MetricsClient'),
};

// Create and configure container
export function createContainer(config: Config): Container {
  const container = new Container();

  // Bind configuration
  container.bind<Config>(TYPES.Config).toConstantValue(config);

  // Bind services with their dependencies
  container.bind<CircleWalletsService>(TYPES.CircleWalletsService)
    .toDynamicValue((context) => {
      const cfg = context.container.get<Config>(TYPES.Config);
      return new CircleWalletsService({
        apiKey: cfg.circleApiKey,
        entitySecret: cfg.circleEntitySecret,
      });
    })
    .inSingletonScope();

  container.bind<CircleGatewayService>(TYPES.CircleGatewayService)
    .toDynamicValue((context) => {
      const cfg = context.container.get<Config>(TYPES.Config);
      return new CircleGatewayService({
        apiKey: cfg.circleGatewayApiKey,
        webhookSecret: cfg.circleGatewayWebhookSecret,
      });
    })
    .inSingletonScope();

  container.bind<InvoiceService>(TYPES.InvoiceService)
    .toDynamicValue((context) => {
      const cfg = context.container.get<Config>(TYPES.Config);
      const walletsService = context.container.get<CircleWalletsService>(
        TYPES.CircleWalletsService
      );
      return new InvoiceService(cfg, walletsService);
    })
    .inSingletonScope();

  container.bind<FundingService>(TYPES.FundingService)
    .toDynamicValue((context) => {
      const cfg = context.container.get<Config>(TYPES.Config);
      const invoiceService = context.container.get<InvoiceService>(
        TYPES.InvoiceService
      );
      return new FundingService(cfg, invoiceService);
    })
    .inSingletonScope();

  container.bind<RepaymentService>(TYPES.RepaymentService)
    .toDynamicValue((context) => {
      const cfg = context.container.get<Config>(TYPES.Config);
      const invoiceService = context.container.get<InvoiceService>(
        TYPES.InvoiceService
      );
      return new RepaymentService(cfg, invoiceService);
    })
    .inSingletonScope();

  return container;
}

// Singleton instance for production
let container: Container | null = null;

export function getContainer(): Container {
  if (!container) {
    const config = loadConfig();
    container = createContainer(config);
  }
  return container;
}

// For testing - create isolated container
export function createTestContainer(overrides?: Partial<Config>): Container {
  const config = { ...loadConfig(), ...overrides };
  return createContainer(config);
}
```

```typescript
// backend/lib/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  // Circle credentials
  circleApiKey: z.string().min(1),
  circleEntitySecret: z.string().length(64),
  circleGatewayApiKey: z.string().min(1),
  circleGatewayWebhookSecret: z.string().min(1),

  // Blockchain
  rpcUrl: z.string().url(),
  chainId: z.number().int().positive(),

  // Contract addresses
  invoiceDiamondAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  executionPoolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  liquidityPoolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  usdcAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  // Feature flags
  enableTreasury: z.boolean().default(false),
  enableCrossChain: z.boolean().default(false),

  // Operational
  environment: z.enum(['development', 'staging', 'production']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const rawConfig = {
    circleApiKey: process.env.CIRCLE_API_KEY,
    circleEntitySecret: process.env.CIRCLE_ENTITY_SECRET,
    circleGatewayApiKey: process.env.CIRCLE_GATEWAY_API_KEY,
    circleGatewayWebhookSecret: process.env.CIRCLE_GATEWAY_WEBHOOK_SECRET,
    rpcUrl: process.env.RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '8453', 10),
    invoiceDiamondAddress: process.env.INVOICE_DIAMOND_ADDRESS,
    executionPoolAddress: process.env.EXECUTION_POOL_ADDRESS,
    liquidityPoolAddress: process.env.LIQUIDITY_POOL_ADDRESS,
    usdcAddress: process.env.USDC_ADDRESS,
    enableTreasury: process.env.ENABLE_TREASURY === 'true',
    enableCrossChain: process.env.ENABLE_CROSS_CHAIN === 'true',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  };

  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}
```

```typescript
// backend/api/webhooks/circle-gateway.ts (updated)
import { NextRequest, NextResponse } from 'next/server';
import { getContainer, TYPES } from '@/lib/container';
import { CircleGatewayService } from '@/services/CircleGatewayService';

export async function POST(request: NextRequest) {
  const container = getContainer();
  const gatewayService = container.get<CircleGatewayService>(
    TYPES.CircleGatewayService
  );

  // Now testable - can inject mock service
  await gatewayService.processWebhook(request);
}
```

---

## Error Handling Strategy

### Problem: Inconsistent Error Handling

**Current Code:**
```typescript
async getSupplierInvoices(supplierAddress: string): Promise<Invoice[]> {
  const invoiceIds = await this.contract.getSupplierInvoices(supplierAddress);
  // If any invoice fails, entire operation fails
  return Promise.all(invoiceIds.map((id) => this.getInvoice(id)));
}
```

### Solution: Comprehensive Error Framework

```typescript
// backend/lib/errors.ts

// Base error class
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404, true, { resource, id });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, true, context);
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    service: string,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, true, context);
    this.service = service;
    this.originalError = originalError;
  }
}

export class BlockchainError extends AppError {
  public readonly txHash?: string;
  public readonly reason?: string;

  constructor(
    message: string,
    txHash?: string,
    reason?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'BLOCKCHAIN_ERROR', 500, true, context);
    this.txHash = txHash;
    this.reason = reason;
  }
}

// Error handler utility
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('insufficient funds')) {
      return new BlockchainError('Insufficient funds for transaction', undefined, error.message);
    }
    if (error.message.includes('nonce')) {
      return new BlockchainError('Transaction nonce error', undefined, error.message);
    }
    if (error.message.includes('timeout')) {
      return new ExternalServiceError('blockchain', 'RPC request timeout', error);
    }

    return new AppError(error.message, 'INTERNAL_ERROR', 500, false);
  }

  return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR', 500, false);
}
```

```typescript
// backend/lib/result.ts
// Result type for explicit error handling

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

// Utility to wrap async functions
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T, AppError>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(handleError(error));
  }
}
```

```typescript
// backend/services/InvoiceService.ts (updated)
import { Result, ok, err, tryCatch } from '../lib/result';
import { NotFoundError, ValidationError, BlockchainError } from '../lib/errors';

export class InvoiceService {
  async getInvoice(invoiceId: bigint): Promise<Result<Invoice>> {
    return tryCatch(async () => {
      const data = await this.contract.getInvoice(invoiceId);

      if (!data || data.createdAt === 0n) {
        throw new NotFoundError('Invoice', invoiceId.toString());
      }

      return this.mapToInvoice(invoiceId, data);
    });
  }

  async getSupplierInvoices(supplierAddress: string): Promise<Result<Invoice[]>> {
    return tryCatch(async () => {
      const invoiceIds = await this.contract.getSupplierInvoices(supplierAddress);

      // Use allSettled to handle partial failures
      const results = await Promise.allSettled(
        invoiceIds.map(async (id) => {
          const result = await this.getInvoice(id);
          if (!result.success) {
            throw result.error;
          }
          return result.data;
        })
      );

      // Collect successful results, log failures
      const invoices: Invoice[] = [];
      const failures: Array<{ id: bigint; error: unknown }> = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          invoices.push(result.value);
        } else {
          failures.push({ id: invoiceIds[index], error: result.reason });
        }
      });

      if (failures.length > 0) {
        console.warn(`Failed to fetch ${failures.length} invoices`, failures);
      }

      return invoices;
    });
  }

  async createInvoice(
    supplierWalletId: string,
    params: CreateInvoiceParams
  ): Promise<Result<{ invoiceId: bigint; txHash: string }>> {
    // Validate params first
    const validationResult = this.validateCreateParams(params);
    if (!validationResult.success) {
      return err(validationResult.error);
    }

    return tryCatch(async () => {
      const tx = await this.walletService.executeTransaction({
        walletId: supplierWalletId,
        contractAddress: this.config.invoiceDiamondAddress,
        functionSignature: 'createInvoice(address,uint128,uint16,uint64,bytes32,bytes32)',
        args: [
          params.buyerAddress,
          params.faceValue.toString(),
          params.discountRateBps.toString(),
          Math.floor(params.maturityDate.getTime() / 1000).toString(),
          params.invoiceHash || '0x' + '0'.repeat(64),
          params.externalId || '0x' + '0'.repeat(64),
        ],
      });

      // Wait for confirmation
      const receipt = await this.waitForTransaction(tx.hash);

      if (!receipt.success) {
        throw new BlockchainError(
          'Invoice creation failed',
          tx.hash,
          receipt.reason
        );
      }

      // Parse invoice ID from events
      const invoiceId = this.parseInvoiceIdFromReceipt(receipt);

      return { invoiceId, txHash: tx.hash };
    });
  }

  private validateCreateParams(params: CreateInvoiceParams): Result<void, ValidationError> {
    const errors: string[] = [];

    if (!params.buyerAddress || !/^0x[a-fA-F0-9]{40}$/.test(params.buyerAddress)) {
      errors.push('Invalid buyer address');
    }

    if (params.faceValue <= 0n) {
      errors.push('Face value must be positive');
    }

    if (params.faceValue > BigInt(1e15)) { // 1 billion USDC max
      errors.push('Face value exceeds maximum');
    }

    if (params.discountRateBps < 0 || params.discountRateBps > 5000) {
      errors.push('Discount rate must be 0-5000 bps (0-50%)');
    }

    if (params.maturityDate <= new Date()) {
      errors.push('Maturity date must be in the future');
    }

    const maxMaturity = new Date();
    maxMaturity.setDate(maxMaturity.getDate() + 365);
    if (params.maturityDate > maxMaturity) {
      errors.push('Maturity date cannot exceed 365 days');
    }

    if (errors.length > 0) {
      return err(new ValidationError(errors.join('; '), { params }));
    }

    return ok(undefined);
  }
}
```

---

## Resilience Patterns

### Retry Logic with Exponential Backoff

```typescript
// backend/lib/retry.ts
import { AppError, ExternalServiceError } from './errors';

interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const defaultOptions: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'rate limit',
    'timeout',
    '429',
    '503',
    '504',
  ],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = opts.retryableErrors?.some(
        (pattern) =>
          lastError!.message.toLowerCase().includes(pattern.toLowerCase()) ||
          (lastError as any).code === pattern
      );

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Call retry callback
      opts.onRetry?.(attempt, lastError, delay);

      // Wait before retry
      await sleep(delay);

      // Increase delay for next attempt
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Usage in services
export class CircleWalletsService {
  async executeTransaction(params: TransactionParams): Promise<TransactionResult> {
    return withRetry(
      () => this.client.createTransaction(params),
      {
        maxAttempts: 3,
        onRetry: (attempt, error, delay) => {
          console.warn(
            `Circle API call failed (attempt ${attempt}), retrying in ${delay}ms:`,
            error.message
          );
        },
      }
    );
  }
}
```

### Circuit Breaker Pattern

```typescript
// backend/lib/circuit-breaker.ts

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls
  HALF_OPEN = 'HALF_OPEN' // Testing if recovered
}

interface CircuitBreakerOptions {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes before closing
  timeout: number;             // Time in OPEN state before HALF_OPEN (ms)
  monitorInterval: number;     // Reset failure count interval (ms)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(
    private readonly name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      monitorInterval: 60000,
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.timeout) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`Circuit breaker [${this.name}] entering HALF_OPEN state`);
      } else {
        throw new ExternalServiceError(
          this.name,
          `Circuit breaker is OPEN. Service temporarily unavailable.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        console.log(`Circuit breaker [${this.name}] CLOSED - service recovered`);
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.successes = 0;
      console.log(`Circuit breaker [${this.name}] OPEN - test request failed`);
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log(`Circuit breaker [${this.name}] OPEN - failure threshold reached`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failures: number; successes: number } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
  }
}

// Usage
const rpcCircuitBreaker = new CircuitBreaker('rpc', {
  failureThreshold: 3,
  timeout: 60000,
});

async function callRpc<T>(fn: () => Promise<T>): Promise<T> {
  return rpcCircuitBreaker.execute(fn);
}
```

### Rate Limiter

```typescript
// backend/lib/rate-limiter.ts

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Remove timestamps outside window
    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    if (this.timestamps.length >= this.options.maxRequests) {
      // Calculate wait time
      const oldestTimestamp = this.timestamps[0];
      const waitTime = oldestTimestamp + this.options.windowMs - now;

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.acquire(); // Retry after waiting
      }
    }

    this.timestamps.push(now);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }
}

// Usage for RPC calls
const rpcRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 1000, // 100 requests per second
});

async function makeRpcCall<T>(fn: () => Promise<T>): Promise<T> {
  return rpcRateLimiter.execute(fn);
}
```

---

## API Design Improvements

### Request/Response Schema Validation

```typescript
// backend/lib/validation.ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from './errors';

// Schema definitions
export const CreateInvoiceSchema = z.object({
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
  faceValue: z.string().refine(
    (val) => {
      try {
        const n = BigInt(val);
        return n > 0n && n <= BigInt(1e15);
      } catch {
        return false;
      }
    },
    'Invalid face value'
  ),
  discountRateBps: z.number().int().min(0).max(5000),
  maturityDate: z.string().datetime(),
  invoiceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  externalId: z.string().max(100).optional(),
});

export const ApproveInvoiceSchema = z.object({
  invoiceId: z.string().refine((val) => {
    try {
      BigInt(val);
      return true;
    } catch {
      return false;
    }
  }),
});

// Validation middleware
export function validateBody<T>(schema: z.Schema<T>) {
  return async (request: NextRequest): Promise<T> => {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new ValidationError(errors.join('; '));
    }

    return result.data;
  };
}

// Response helpers
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

export function errorResponse(error: AppError): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.context && { context: error.context }),
      },
    },
    { status: error.statusCode }
  );
}
```

### API Route Example

```typescript
// backend/api/invoices/create/route.ts
import { NextRequest } from 'next/server';
import { getContainer, TYPES } from '@/lib/container';
import { validateBody, CreateInvoiceSchema, successResponse, errorResponse } from '@/lib/validation';
import { handleError } from '@/lib/errors';
import { InvoiceService } from '@/services/InvoiceService';

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await validateBody(CreateInvoiceSchema)(request);

    // Get service from container
    const container = getContainer();
    const invoiceService = container.get<InvoiceService>(TYPES.InvoiceService);

    // Execute business logic
    const result = await invoiceService.createInvoice(
      body.supplierWalletId,
      {
        buyerAddress: body.buyerAddress,
        faceValue: BigInt(body.faceValue),
        discountRateBps: body.discountRateBps,
        maturityDate: new Date(body.maturityDate),
        invoiceHash: body.invoiceHash,
        externalId: body.externalId,
      }
    );

    if (!result.success) {
      return errorResponse(result.error);
    }

    return successResponse({
      invoiceId: result.data.invoiceId.toString(),
      txHash: result.data.txHash,
    }, 201);

  } catch (error) {
    const appError = handleError(error);
    console.error('Create invoice error:', appError);
    return errorResponse(appError);
  }
}
```

---

## Observability & Monitoring

### Structured Logging

```typescript
// backend/lib/logger.ts
import pino from 'pino';

export interface LogContext {
  service?: string;
  operation?: string;
  invoiceId?: string;
  walletId?: string;
  txHash?: string;
  duration?: number;
  [key: string]: unknown;
}

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }

  info(message: string, data?: Record<string, unknown>): void {
    baseLogger.info({ ...this.context, ...data }, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    baseLogger.warn({ ...this.context, ...data }, message);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    baseLogger.error(
      {
        ...this.context,
        ...data,
        error: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      },
      message
    );
  }

  debug(message: string, data?: Record<string, unknown>): void {
    baseLogger.debug({ ...this.context, ...data }, message);
  }
}

export const logger = new Logger({ service: 'seed-finance' });
```

### Metrics Collection

```typescript
// backend/lib/metrics.ts
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

const registry = new Registry();

// Define metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const invoicesCreated = new Counter({
  name: 'invoices_created_total',
  help: 'Total number of invoices created',
  registers: [registry],
});

export const invoicesFunded = new Counter({
  name: 'invoices_funded_total',
  help: 'Total number of invoices funded',
  registers: [registry],
});

export const invoicesRepaid = new Counter({
  name: 'invoices_repaid_total',
  help: 'Total number of invoices repaid',
  registers: [registry],
});

export const fundingVolume = new Counter({
  name: 'funding_volume_usdc',
  help: 'Total USDC volume funded',
  registers: [registry],
});

export const activeCircuitBreakers = new Gauge({
  name: 'circuit_breakers_open',
  help: 'Number of open circuit breakers',
  labelNames: ['name'],
  registers: [registry],
});

export const rpcCallDuration = new Histogram({
  name: 'rpc_call_duration_seconds',
  help: 'Duration of RPC calls',
  labelNames: ['method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

// Expose registry for /metrics endpoint
export { registry };
```

---

## Implementation Guide

### Phase 1: Foundation (Week 1)

1. Implement configuration management with Zod validation
2. Set up dependency injection container
3. Create error handling framework
4. Add structured logging

### Phase 2: Resilience (Week 2)

1. Implement retry logic with backoff
2. Add circuit breaker for external services
3. Implement rate limiting
4. Add health check endpoints

### Phase 3: API Improvements (Week 3)

1. Add request/response validation
2. Standardize error responses
3. Add OpenAPI documentation
4. Implement API versioning

### Phase 4: Observability (Week 4)

1. Add metrics collection
2. Set up distributed tracing
3. Create monitoring dashboards
4. Set up alerting rules

---

## References

- [Inversify - TypeScript DI Container](https://inversify.io/)
- [Zod - TypeScript Schema Validation](https://zod.dev/)
- [Pino - Fast JSON Logger](https://getpino.io/)
- [Prometheus Client](https://github.com/siimon/prom-client)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
