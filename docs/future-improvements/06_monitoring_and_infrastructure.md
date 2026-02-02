# 06. Monitoring and Infrastructure Improvements

## Executive Summary

This document outlines the monitoring, alerting, and infrastructure improvements needed for production-ready deployment of Seed Finance. Topics include on-chain event monitoring, off-chain service observability, deployment automation, and operational runbooks.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [On-Chain Monitoring](#on-chain-monitoring)
3. [Off-Chain Observability](#off-chain-observability)
4. [Alerting Strategy](#alerting-strategy)
5. [Deployment Automation](#deployment-automation)
6. [Operational Runbooks](#operational-runbooks)
7. [Implementation Plan](#implementation-plan)

---

## Current State Analysis

### Missing Infrastructure Components

| Component | Current State | Target State |
|-----------|--------------|--------------|
| Event Indexing | None | The Graph / Ponder |
| Metrics Collection | None | Prometheus + Grafana |
| Log Aggregation | Console only | ELK Stack / Datadog |
| Alerting | None | PagerDuty / Opsgenie |
| APM | None | New Relic / Datadog APM |
| Deployment | Manual scripts | GitHub Actions + ArgoCD |
| Secrets Management | .env files | HashiCorp Vault |
| Infrastructure as Code | None | Terraform |

---

## On-Chain Monitoring

### 1. Event Indexing with The Graph

**Subgraph Configuration:**

```yaml
# subgraph/subgraph.yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: InvoiceDiamond
    network: base
    source:
      address: "0x..."
      abi: InvoiceDiamond
      startBlock: 12345678
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Invoice
        - Buyer
        - Supplier
        - DailyStats
        - ProtocolStats
      abis:
        - name: InvoiceDiamond
          file: ./abis/InvoiceDiamond.json
      eventHandlers:
        - event: InvoiceCreated(indexed uint256,indexed address,indexed address,uint128,uint16,uint64,bytes32,bytes32)
          handler: handleInvoiceCreated
        - event: InvoiceApproved(indexed uint256,indexed address,uint64)
          handler: handleInvoiceApproved
        - event: InvoiceFunded(indexed uint256,uint128,uint64)
          handler: handleInvoiceFunded
        - event: InvoicePaid(indexed uint256,uint128,uint64)
          handler: handleInvoicePaid
        - event: InvoiceCancelled(indexed uint256,address)
          handler: handleInvoiceCancelled
        - event: InvoiceDefaulted(indexed uint256,uint64)
          handler: handleInvoiceDefaulted
      file: ./src/mapping.ts

  - kind: ethereum
    name: LiquidityPool
    network: base
    source:
      address: "0x..."
      abi: LiquidityPool
      startBlock: 12345678
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Deposit
        - Withdrawal
        - LPPosition
        - PoolStats
      abis:
        - name: LiquidityPool
          file: ./abis/LiquidityPool.json
      eventHandlers:
        - event: Deposit(indexed address,indexed address,uint256,uint256)
          handler: handleDeposit
        - event: Withdraw(indexed address,indexed address,indexed address,uint256,uint256)
          handler: handleWithdraw
        - event: LiquidityDeployed(uint256,uint256)
          handler: handleLiquidityDeployed
        - event: LiquidityReturned(uint256,uint256,uint256)
          handler: handleLiquidityReturned
      file: ./src/pool-mapping.ts
```

### 2. Real-Time Event Listener

```typescript
// backend/services/EventListenerService.ts
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { EventEmitter } from 'events';

interface EventListenerConfig {
  rpcUrl: string;
  invoiceDiamondAddress: `0x${string}`;
  liquidityPoolAddress: `0x${string}`;
  executionPoolAddress: `0x${string}`;
}

export class EventListenerService extends EventEmitter {
  private client: any;
  private config: EventListenerConfig;
  private unsubscribers: (() => void)[] = [];

  constructor(config: EventListenerConfig) {
    super();
    this.config = config;
    this.client = createPublicClient({
      chain: base,
      transport: http(config.rpcUrl),
    });
  }

  async start(): Promise<void> {
    // Listen for Invoice events
    const invoiceUnwatch = this.client.watchContractEvent({
      address: this.config.invoiceDiamondAddress,
      abi: [
        parseAbiItem('event InvoiceCreated(uint256 indexed invoiceId, address indexed buyer, address indexed supplier, uint128 faceValue, uint16 discountRateBps, uint64 maturityDate, bytes32 invoiceHash, bytes32 externalId)'),
        parseAbiItem('event InvoiceApproved(uint256 indexed invoiceId, address indexed buyer, uint64 approvedAt)'),
        parseAbiItem('event InvoiceFunded(uint256 indexed invoiceId, uint128 fundingAmount, uint64 fundedAt)'),
        parseAbiItem('event InvoicePaid(uint256 indexed invoiceId, uint128 amountPaid, uint64 paidAt)'),
        parseAbiItem('event InvoiceDefaulted(uint256 indexed invoiceId, uint64 defaultedAt)'),
      ],
      onLogs: (logs) => {
        for (const log of logs) {
          this.handleInvoiceEvent(log);
        }
      },
      onError: (error) => {
        console.error('Invoice event listener error:', error);
        this.emit('error', { source: 'invoice', error });
      },
    });

    // Listen for LiquidityPool events
    const poolUnwatch = this.client.watchContractEvent({
      address: this.config.liquidityPoolAddress,
      abi: [
        parseAbiItem('event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)'),
        parseAbiItem('event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)'),
      ],
      onLogs: (logs) => {
        for (const log of logs) {
          this.handlePoolEvent(log);
        }
      },
      onError: (error) => {
        console.error('Pool event listener error:', error);
        this.emit('error', { source: 'pool', error });
      },
    });

    this.unsubscribers.push(invoiceUnwatch, poolUnwatch);
    console.log('Event listeners started');
  }

  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    console.log('Event listeners stopped');
  }

  private handleInvoiceEvent(log: any): void {
    const eventName = log.eventName;
    const args = log.args;

    console.log(`Invoice event: ${eventName}`, args);

    // Emit typed events
    this.emit('invoice:' + eventName.toLowerCase(), {
      ...args,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
    });

    // Update metrics
    this.updateMetrics(eventName, args);
  }

  private handlePoolEvent(log: any): void {
    const eventName = log.eventName;
    const args = log.args;

    console.log(`Pool event: ${eventName}`, args);

    this.emit('pool:' + eventName.toLowerCase(), {
      ...args,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
    });
  }

  private updateMetrics(eventName: string, args: any): void {
    // Integration with Prometheus metrics
    switch (eventName) {
      case 'InvoiceCreated':
        // invoicesCreatedTotal.inc();
        break;
      case 'InvoiceFunded':
        // invoicesFundedTotal.inc();
        // fundingVolumeTotal.inc(Number(args.fundingAmount) / 1e6);
        break;
      case 'InvoicePaid':
        // invoicesPaidTotal.inc();
        break;
      case 'InvoiceDefaulted':
        // invoicesDefaultedTotal.inc();
        break;
    }
  }
}
```

### 3. Contract State Monitoring

```typescript
// backend/services/ContractMonitorService.ts
import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { Gauge, Registry } from 'prom-client';

export class ContractMonitorService {
  private client: any;
  private registry: Registry;
  private intervalId?: NodeJS.Timer;

  // Metrics
  private poolTotalAssets: Gauge;
  private poolTotalShares: Gauge;
  private poolUtilization: Gauge;
  private poolSharePrice: Gauge;
  private invoiceActiveCount: Gauge;
  private invoiceTotalFunded: Gauge;
  private invoiceTotalRepaid: Gauge;
  private treasuryTotalValue: Gauge;

  constructor(config: any, registry: Registry) {
    this.client = createPublicClient({
      chain: base,
      transport: http(config.rpcUrl),
    });
    this.registry = registry;

    // Initialize metrics
    this.poolTotalAssets = new Gauge({
      name: 'liquidity_pool_total_assets_usdc',
      help: 'Total assets in the liquidity pool (USDC)',
      registers: [registry],
    });

    this.poolTotalShares = new Gauge({
      name: 'liquidity_pool_total_shares',
      help: 'Total shares outstanding',
      registers: [registry],
    });

    this.poolUtilization = new Gauge({
      name: 'liquidity_pool_utilization_ratio',
      help: 'Pool utilization ratio (0-1)',
      registers: [registry],
    });

    this.poolSharePrice = new Gauge({
      name: 'liquidity_pool_share_price_usdc',
      help: 'Current share price in USDC',
      registers: [registry],
    });

    this.invoiceActiveCount = new Gauge({
      name: 'invoice_active_count',
      help: 'Number of active (funded) invoices',
      registers: [registry],
    });

    this.invoiceTotalFunded = new Gauge({
      name: 'invoice_total_funded_usdc',
      help: 'Total USDC funded',
      registers: [registry],
    });

    this.invoiceTotalRepaid = new Gauge({
      name: 'invoice_total_repaid_usdc',
      help: 'Total USDC repaid',
      registers: [registry],
    });

    this.treasuryTotalValue = new Gauge({
      name: 'treasury_total_value_usdc',
      help: 'Total value in treasury strategies',
      registers: [registry],
    });
  }

  async start(intervalMs: number = 30000): Promise<void> {
    // Initial poll
    await this.poll();

    // Start polling interval
    this.intervalId = setInterval(() => {
      this.poll().catch((error) => {
        console.error('Contract monitor poll error:', error);
      });
    }, intervalMs);

    console.log(`Contract monitor started (interval: ${intervalMs}ms)`);
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log('Contract monitor stopped');
  }

  private async poll(): Promise<void> {
    try {
      // Poll LiquidityPool
      const [totalAssets, totalShares, utilization] = await Promise.all([
        this.client.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: 'totalAssets',
        }),
        this.client.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: 'totalSupply',
        }),
        this.client.readContract({
          address: LIQUIDITY_POOL_ADDRESS,
          abi: liquidityPoolAbi,
          functionName: 'utilizationRate',
        }),
      ]);

      this.poolTotalAssets.set(Number(formatUnits(totalAssets, 6)));
      this.poolTotalShares.set(Number(formatUnits(totalShares, 6)));
      this.poolUtilization.set(Number(utilization) / 10000);

      if (totalShares > 0n) {
        const sharePrice = (totalAssets * BigInt(1e6)) / totalShares;
        this.poolSharePrice.set(Number(formatUnits(sharePrice, 6)));
      }

      // Poll InvoiceDiamond stats
      const [totalFunded, totalRepaid, activeCount] = await this.client.readContract({
        address: INVOICE_DIAMOND_ADDRESS,
        abi: invoiceDiamondAbi,
        functionName: 'getStats',
      });

      this.invoiceTotalFunded.set(Number(formatUnits(totalFunded, 6)));
      this.invoiceTotalRepaid.set(Number(formatUnits(totalRepaid, 6)));
      this.invoiceActiveCount.set(Number(activeCount));

      // Poll TreasuryManager
      const treasuryValue = await this.client.readContract({
        address: TREASURY_MANAGER_ADDRESS,
        abi: treasuryManagerAbi,
        functionName: 'totalValue',
      });

      this.treasuryTotalValue.set(Number(formatUnits(treasuryValue, 6)));

    } catch (error) {
      console.error('Contract poll error:', error);
      throw error;
    }
  }
}
```

---

## Off-Chain Observability

### 1. Prometheus Metrics Configuration

```typescript
// backend/lib/metrics.ts
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a registry
export const registry = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register: registry });

// HTTP metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// Business metrics
export const invoicesCreatedTotal = new Counter({
  name: 'invoices_created_total',
  help: 'Total invoices created',
  registers: [registry],
});

export const invoicesFundedTotal = new Counter({
  name: 'invoices_funded_total',
  help: 'Total invoices funded',
  registers: [registry],
});

export const fundingVolumeTotal = new Counter({
  name: 'funding_volume_usdc_total',
  help: 'Total USDC volume funded',
  registers: [registry],
});

export const repaymentVolumeTotal = new Counter({
  name: 'repayment_volume_usdc_total',
  help: 'Total USDC volume repaid',
  registers: [registry],
});

// External service metrics
export const circleApiCalls = new Counter({
  name: 'circle_api_calls_total',
  help: 'Total Circle API calls',
  labelNames: ['method', 'status'],
  registers: [registry],
});

export const circleApiDuration = new Histogram({
  name: 'circle_api_duration_seconds',
  help: 'Duration of Circle API calls',
  labelNames: ['method'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const rpcCalls = new Counter({
  name: 'rpc_calls_total',
  help: 'Total RPC calls',
  labelNames: ['method', 'status'],
  registers: [registry],
});

export const rpcDuration = new Histogram({
  name: 'rpc_duration_seconds',
  help: 'Duration of RPC calls',
  labelNames: ['method'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

// Circuit breaker metrics
export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['name'],
  registers: [registry],
});
```

### 2. Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Seed Finance Operations",
    "tags": ["seed-finance", "production"],
    "panels": [
      {
        "title": "Invoice Volume (24h)",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(invoices_created_total[24h])",
            "legendFormat": "Created"
          },
          {
            "expr": "increase(invoices_funded_total[24h])",
            "legendFormat": "Funded"
          }
        ]
      },
      {
        "title": "Funding Volume (USDC)",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(funding_volume_usdc_total[1h]) * 3600",
            "legendFormat": "Hourly Funding Rate"
          }
        ]
      },
      {
        "title": "Pool Utilization",
        "type": "gauge",
        "targets": [
          {
            "expr": "liquidity_pool_utilization_ratio * 100",
            "legendFormat": "Utilization %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                { "value": 0, "color": "green" },
                { "value": 70, "color": "yellow" },
                { "value": 90, "color": "red" }
              ]
            }
          }
        }
      },
      {
        "title": "API Response Time (p95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95 latency"
          }
        ]
      },
      {
        "title": "Circle API Health",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(circle_api_calls_total{status=\"success\"}[5m])) / sum(rate(circle_api_calls_total[5m])) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      },
      {
        "title": "Active Invoices by Status",
        "type": "piechart",
        "targets": [
          {
            "expr": "invoice_active_count",
            "legendFormat": "Funded"
          }
        ]
      },
      {
        "title": "Share Price Trend",
        "type": "graph",
        "targets": [
          {
            "expr": "liquidity_pool_share_price_usdc",
            "legendFormat": "Share Price (USDC)"
          }
        ]
      },
      {
        "title": "Circuit Breaker Status",
        "type": "stat",
        "targets": [
          {
            "expr": "circuit_breaker_state",
            "legendFormat": "{{name}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "mappings": [
              { "type": "value", "value": "0", "text": "CLOSED" },
              { "type": "value", "value": "1", "text": "OPEN" },
              { "type": "value", "value": "2", "text": "HALF-OPEN" }
            ]
          }
        }
      }
    ]
  }
}
```

### 3. Structured Logging

```typescript
// backend/lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: 'seed-finance-backend',
      version: process.env.APP_VERSION || 'unknown',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Add request context
  mixin() {
    return {
      environment: process.env.NODE_ENV,
    };
  },
});

// Child logger for specific contexts
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export default logger;
```

---

## Alerting Strategy

### Alert Rules Configuration

```yaml
# alerting/rules.yml
groups:
  - name: seed-finance-critical
    rules:
      # High pool utilization
      - alert: HighPoolUtilization
        expr: liquidity_pool_utilization_ratio > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pool utilization above 90%"
          description: "Liquidity pool utilization is {{ $value | humanizePercentage }}"

      # Invoice funding failures
      - alert: InvoiceFundingFailures
        expr: rate(invoice_funding_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High rate of invoice funding failures"
          description: "{{ $value }} funding failures per second"

      # Circle API down
      - alert: CircleAPIDown
        expr: sum(rate(circle_api_calls_total{status="error"}[5m])) / sum(rate(circle_api_calls_total[5m])) > 0.5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Circle API error rate above 50%"

      # RPC connection issues
      - alert: RPCConnectionIssues
        expr: circuit_breaker_state{name="rpc"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "RPC circuit breaker is OPEN"

  - name: seed-finance-warning
    rules:
      # Elevated pool utilization
      - alert: ElevatedPoolUtilization
        expr: liquidity_pool_utilization_ratio > 0.7
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Pool utilization above 70%"

      # Overdue invoices
      - alert: OverdueInvoices
        expr: invoice_overdue_count > 5
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "{{ $value }} invoices are overdue"

      # Share price decrease
      - alert: SharePriceDecrease
        expr: (liquidity_pool_share_price_usdc - liquidity_pool_share_price_usdc offset 1h) / liquidity_pool_share_price_usdc offset 1h < -0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Share price decreased by more than 1% in the last hour"

      # High API latency
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API p95 latency above 2 seconds"

  - name: seed-finance-info
    rules:
      # Large deposit
      - alert: LargeDeposit
        expr: increase(funding_volume_usdc_total[1m]) > 100000
        labels:
          severity: info
        annotations:
          summary: "Large deposit detected: {{ $value | humanize }} USDC"

      # New daily high volume
      - alert: NewDailyHighVolume
        expr: increase(funding_volume_usdc_total[24h]) > increase(funding_volume_usdc_total[24h] offset 24h) * 1.5
        labels:
          severity: info
        annotations:
          summary: "Daily volume 50% higher than previous day"
```

### PagerDuty Integration

```typescript
// backend/lib/alerting.ts
import axios from 'axios';

interface AlertPayload {
  severity: 'critical' | 'error' | 'warning' | 'info';
  summary: string;
  details?: Record<string, unknown>;
  source?: string;
  dedup_key?: string;
}

export class AlertingService {
  private pagerdutyKey: string;
  private slackWebhook?: string;

  constructor(config: { pagerdutyKey: string; slackWebhook?: string }) {
    this.pagerdutyKey = config.pagerdutyKey;
    this.slackWebhook = config.slackWebhook;
  }

  async sendAlert(alert: AlertPayload): Promise<void> {
    const promises: Promise<void>[] = [];

    // Send to PagerDuty for critical/error
    if (alert.severity === 'critical' || alert.severity === 'error') {
      promises.push(this.sendToPagerDuty(alert));
    }

    // Send to Slack for all alerts
    if (this.slackWebhook) {
      promises.push(this.sendToSlack(alert));
    }

    await Promise.allSettled(promises);
  }

  private async sendToPagerDuty(alert: AlertPayload): Promise<void> {
    const payload = {
      routing_key: this.pagerdutyKey,
      event_action: 'trigger',
      dedup_key: alert.dedup_key || `${alert.source}-${alert.summary}`,
      payload: {
        summary: alert.summary,
        severity: alert.severity,
        source: alert.source || 'seed-finance',
        custom_details: alert.details,
      },
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
  }

  private async sendToSlack(alert: AlertPayload): Promise<void> {
    const colorMap = {
      critical: '#FF0000',
      error: '#FF6600',
      warning: '#FFCC00',
      info: '#0066FF',
    };

    const payload = {
      attachments: [
        {
          color: colorMap[alert.severity],
          title: `[${alert.severity.toUpperCase()}] ${alert.summary}`,
          fields: alert.details
            ? Object.entries(alert.details).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              }))
            : [],
          footer: alert.source || 'Seed Finance',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await axios.post(this.slackWebhook!, payload);
  }

  async resolveAlert(dedup_key: string): Promise<void> {
    const payload = {
      routing_key: this.pagerdutyKey,
      event_action: 'resolve',
      dedup_key,
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
  }
}
```

---

## Deployment Automation

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          cd contracts && forge test
          cd ../backend && npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker images
        run: |
          docker build -t seed-finance-backend:${{ github.sha }} ./backend
          docker build -t seed-finance-frontend:${{ github.sha }} ./frontend

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push seed-finance-backend:${{ github.sha }}
          docker push seed-finance-frontend:${{ github.sha }}

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main' || github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: |
          # Update Kubernetes manifests
          sed -i "s|image:.*|image: seed-finance-backend:${{ github.sha }}|" k8s/staging/backend-deployment.yaml
          sed -i "s|image:.*|image: seed-finance-frontend:${{ github.sha }}|" k8s/staging/frontend-deployment.yaml

          # Apply manifests
          kubectl apply -f k8s/staging/

      - name: Run smoke tests
        run: |
          npm run test:smoke -- --env staging

  deploy-production:
    needs: deploy-staging
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          # Update Kubernetes manifests
          sed -i "s|image:.*|image: seed-finance-backend:${{ github.sha }}|" k8s/production/backend-deployment.yaml
          sed -i "s|image:.*|image: seed-finance-frontend:${{ github.sha }}|" k8s/production/frontend-deployment.yaml

          # Rolling update with health checks
          kubectl apply -f k8s/production/
          kubectl rollout status deployment/seed-finance-backend -n production --timeout=300s
          kubectl rollout status deployment/seed-finance-frontend -n production --timeout=300s

      - name: Run production smoke tests
        run: |
          npm run test:smoke -- --env production

      - name: Notify deployment
        run: |
          curl -X POST ${{ secrets.SLACK_DEPLOY_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text": "Deployed seed-finance to production: ${{ github.sha }}"}'
```

### Contract Deployment Script

```bash
#!/bin/bash
# scripts/deploy-contracts.sh

set -e

NETWORK=${1:-"base-sepolia"}
VERIFY=${2:-"true"}

echo "Deploying to $NETWORK..."

# Load environment
source .env.$NETWORK

# Deploy contracts
cd contracts

# 1. Deploy libraries first
echo "Deploying LibInvoiceStorage..."
LIB_ADDRESS=$(forge create src/invoice/libraries/LibInvoiceStorage.sol:LibInvoiceStorage \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --json | jq -r '.deployedTo')
echo "LibInvoiceStorage deployed at: $LIB_ADDRESS"

# 2. Deploy facets
echo "Deploying facets..."
INVOICE_FACET=$(forge create src/invoice/facets/InvoiceFacet.sol:InvoiceFacet \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --json | jq -r '.deployedTo')

FUNDING_FACET=$(forge create src/invoice/facets/FundingFacet.sol:FundingFacet \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --json | jq -r '.deployedTo')

REPAYMENT_FACET=$(forge create src/invoice/facets/RepaymentFacet.sol:RepaymentFacet \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --json | jq -r '.deployedTo')

VIEW_FACET=$(forge create src/invoice/facets/ViewFacet.sol:ViewFacet \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --json | jq -r '.deployedTo')

ADMIN_FACET=$(forge create src/invoice/facets/AdminFacet.sol:AdminFacet \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --json | jq -r '.deployedTo')

echo "Facets deployed:"
echo "  InvoiceFacet: $INVOICE_FACET"
echo "  FundingFacet: $FUNDING_FACET"
echo "  RepaymentFacet: $REPAYMENT_FACET"
echo "  ViewFacet: $VIEW_FACET"
echo "  AdminFacet: $ADMIN_FACET"

# 3. Deploy Diamond
echo "Deploying InvoiceDiamond..."
DIAMOND_ADDRESS=$(forge script script/DeployDiamond.s.sol \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --json | jq -r '.returns.diamond.value')
echo "InvoiceDiamond deployed at: $DIAMOND_ADDRESS"

# 4. Deploy ExecutionPool
echo "Deploying ExecutionPool..."
EXECUTION_POOL=$(forge create src/invoice/ExecutionPool.sol:ExecutionPool \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args $USDC_ADDRESS $DIAMOND_ADDRESS $LIQUIDITY_POOL_ADDRESS \
  --json | jq -r '.deployedTo')
echo "ExecutionPool deployed at: $EXECUTION_POOL"

# 5. Configure contracts
echo "Configuring contracts..."
cast send $DIAMOND_ADDRESS "initialize(address,address,address)" \
  $EXECUTION_POOL $LIQUIDITY_POOL_ADDRESS $USDC_ADDRESS \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Grant roles
cast send $LIQUIDITY_POOL_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "ROUTER_ROLE") $EXECUTION_POOL \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# 6. Verify contracts (optional)
if [ "$VERIFY" == "true" ]; then
  echo "Verifying contracts..."
  forge verify-contract $DIAMOND_ADDRESS InvoiceDiamond \
    --chain $NETWORK \
    --etherscan-api-key $ETHERSCAN_API_KEY
fi

# 7. Save deployment info
echo "Saving deployment info..."
cat > deployments/$NETWORK.json << EOF
{
  "network": "$NETWORK",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "invoiceDiamond": "$DIAMOND_ADDRESS",
    "executionPool": "$EXECUTION_POOL",
    "facets": {
      "invoice": "$INVOICE_FACET",
      "funding": "$FUNDING_FACET",
      "repayment": "$REPAYMENT_FACET",
      "view": "$VIEW_FACET",
      "admin": "$ADMIN_FACET"
    }
  }
}
EOF

echo "Deployment complete!"
```

---

## Operational Runbooks

### Runbook: High Pool Utilization

```markdown
# Runbook: High Pool Utilization

## Severity: Critical when > 90%, Warning when > 70%

## Symptoms
- Alert: HighPoolUtilization or ElevatedPoolUtilization
- New funding requests may fail
- Users unable to withdraw full amounts

## Investigation Steps

1. Check current utilization:
   ```bash
   cast call $LIQUIDITY_POOL "utilizationRate()" --rpc-url $RPC_URL
   ```

2. Check pending fundings:
   ```graphql
   query {
     invoices(where: { status: Approved }, first: 100) {
       id
       faceValue
       fundingAmount
     }
   }
   ```

3. Check upcoming repayments:
   ```graphql
   query {
     invoices(where: { status: Funded, maturityDate_lt: $tomorrow }) {
       id
       faceValue
       maturityDate
     }
   }
   ```

## Resolution Options

### Option A: Wait for repayments
- If significant repayments are due within 24h, monitor and wait

### Option B: Withdraw from treasury
```bash
# Check treasury balance
cast call $TREASURY_MANAGER "totalValue()" --rpc-url $RPC_URL

# Withdraw from treasury to pool
cast send $TREASURY_MANAGER "withdraw(uint256)" $AMOUNT \
  --rpc-url $RPC_URL \
  --private-key $ADMIN_KEY
```

### Option C: Pause new fundings temporarily
```bash
# Pause funding operations
cast send $INVOICE_DIAMOND "pauseFunding()" \
  --rpc-url $RPC_URL \
  --private-key $ADMIN_KEY
```

## Post-Resolution
- [ ] Verify utilization is below threshold
- [ ] Resume funding if paused
- [ ] Create post-mortem if prolonged outage
```

### Runbook: Invoice Default Handling

```markdown
# Runbook: Invoice Default Handling

## Trigger
- Invoice maturity date passed
- Buyer has not repaid
- Grace period (if any) exceeded

## Automated Handling

The system automatically marks invoices as defaulted after grace period:
```typescript
// Scheduled job runs daily
await defaultService.processOverdueInvoices();
```

## Manual Investigation

1. Check invoice details:
   ```graphql
   query GetOverdueInvoice($id: ID!) {
     invoice(id: $id) {
       id
       buyer { address }
       supplier { address }
       faceValue
       maturityDate
       status
     }
   }
   ```

2. Contact buyer (via support):
   - Send reminder email
   - Offer payment plan if applicable

3. Mark as defaulted if no response:
   ```bash
   cast send $INVOICE_DIAMOND "markDefaulted(uint256)" $INVOICE_ID \
     --rpc-url $RPC_URL \
     --private-key $OPERATOR_KEY
   ```

## Financial Impact

- Update pool accounting
- Notify LPs of loss (via event)
- Consider insurance claim if coverage exists

## Post-Default Actions
- [ ] Update buyer credit score
- [ ] Review buyer for future invoice limits
- [ ] Document for audit purposes
```

---

## Implementation Plan

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1** | Metrics collection (Prometheus) | 1 week |
| **Phase 2** | Event indexing (The Graph) | 1 week |
| **Phase 3** | Alerting setup (PagerDuty) | 3 days |
| **Phase 4** | Dashboards (Grafana) | 3 days |
| **Phase 5** | Deployment automation | 1 week |
| **Phase 6** | Runbook documentation | 3 days |
| **Total** | | **4-5 weeks** |

---

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [The Graph Documentation](https://thegraph.com/docs/)
- [PagerDuty API](https://developer.pagerduty.com/)
- [Foundry Deployment](https://book.getfoundry.sh/forge/deploying)
