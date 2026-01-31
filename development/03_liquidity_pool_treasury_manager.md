# 03_liquidity_pool_treasury_manager — Implementation Plan

> Feature: LiquidityPool and TreasuryManager Smart Contracts
> Status: In Progress
> Created: 2026-01-31

---

## Overview

Implement the core liquidity layer contracts:
1. **LiquidityPool.sol** — ERC-4626 vault for LP deposits
2. **TreasuryManager.sol** — Manages idle capital with pluggable yield strategies
3. **ITreasuryStrategy.sol** — Interface for treasury strategies (extensibility)
4. **USYCStrategy.sol** — Example strategy for USYC yield (Hashnote)

---

## Architecture: Strategy Pattern for Extensibility

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIQUIDITY LAYER ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    LiquidityPool.sol (ERC-4626)                         │ │
│  │  • LP deposits USDC → receives sfUSDC shares                           │ │
│  │  • Tracks: totalDeployed (invoices) + totalInTreasury (strategies)    │ │
│  │  • Delegates idle capital management to TreasuryManager               │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    TreasuryManager.sol                                  │ │
│  │  • Manages multiple treasury strategies                                │ │
│  │  • Allocates idle USDC across strategies                              │ │
│  │  • Withdraws from strategies when funding needed                       │ │
│  │  • Strategy weights configurable by admin                              │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│           ┌───────────────────────┼───────────────────────┐                 │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │
│  │ USYCStrategy    │   │ AaveStrategy    │   │ CompoundStrategy│           │
│  │ (Hashnote T-Bill)│   │ (Future)        │   │ (Future)        │           │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Interfaces
- [x] `ITreasuryStrategy.sol` — Standard interface for all treasury strategies

### Step 2: Implement LiquidityPool
- [x] ERC-4626 vault implementation
- [x] Role-based access control (ROUTER_ROLE, TREASURY_ROLE)
- [x] Track deployed capital (invoices) and treasury capital (strategies)
- [x] Integration point for TreasuryManager
- [x] Emergency withdrawal mechanism

### Step 3: Implement TreasuryManager
- [x] Multi-strategy support with configurable weights
- [x] Deposit idle capital to strategies
- [x] Withdraw from strategies when funding needed
- [x] Rebalancing mechanism
- [x] Strategy add/remove/pause functionality

### Step 4: Implement USYCStrategy (Example)
- [x] Integration with USYC token (Hashnote Treasury)
- [x] Deposit USDC → receive USYC
- [x] Redeem USYC → receive USDC + yield

---

## Contract Specifications

### ITreasuryStrategy Interface

```solidity
interface ITreasuryStrategy {
    function deposit(uint256 amount) external returns (uint256 shares);
    function withdraw(uint256 amount) external returns (uint256 received);
    function withdrawAll() external returns (uint256 received);
    function totalValue() external view returns (uint256);
    function asset() external view returns (address);
    function isActive() external view returns (bool);
}
```

### LiquidityPool Key Functions

| Function | Description |
|----------|-------------|
| `deposit(uint256 assets, address receiver)` | ERC-4626 deposit |
| `withdraw(uint256 assets, address receiver, address owner)` | ERC-4626 withdraw |
| `deployForFunding(uint256 amount, uint256 invoiceId)` | Send USDC for invoice |
| `receiveRepayment(uint256 principal, uint256 yield, uint256 invoiceId)` | Receive repayment |
| `depositToTreasury(uint256 amount)` | Move idle to treasury |
| `withdrawFromTreasury(uint256 amount)` | Pull from treasury |

### TreasuryManager Key Functions

| Function | Description |
|----------|-------------|
| `addStrategy(address strategy, uint256 weight)` | Add new strategy |
| `removeStrategy(address strategy)` | Remove strategy |
| `setStrategyWeight(address strategy, uint256 weight)` | Update allocation |
| `deposit(uint256 amount)` | Deposit across strategies |
| `withdraw(uint256 amount)` | Withdraw from strategies |
| `rebalance()` | Rebalance to target weights |
| `totalValue()` | Total value across all strategies |

---

## Testing Plan

1. Unit tests for LiquidityPool
   - Deposit/withdraw functionality
   - Share price calculation
   - Access control

2. Unit tests for TreasuryManager
   - Strategy management
   - Deposit/withdraw across strategies
   - Rebalancing

3. Integration tests
   - LiquidityPool + TreasuryManager interaction
   - Full flow: deposit → treasury → withdraw

---

## Files to Create

```
contracts/
├── interfaces/
│   └── ITreasuryStrategy.sol
├── base/
│   ├── LiquidityPool.sol
│   └── TreasuryManager.sol
└── strategies/
    └── USYCStrategy.sol
```

---

## Verification

After implementation:
1. Compile contracts with `npx hardhat compile`
2. Run tests with `npx hardhat test`
3. Check for security issues with static analysis

---

*Document Version: 1.0*
*Created: 2026-01-31*
