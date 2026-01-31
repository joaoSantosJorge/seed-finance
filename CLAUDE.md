# Seed Finance — Technical Implementation Guide

> **This document is the single source of truth for building Seed Finance.**
> Claude: Always read this before implementing any feature.

---

## Project Overview

**Seed Finance** is a decentralized reverse factoring protocol that:
- Uses **Sui** as the credit execution layer (invoice logic, approvals, funding)
- Uses **Arc** (Circle's L1) as the chain-abstracted USDC liquidity hub
- Uses **Circle Gateway** for fiat on/off-ramp settlement
- Uses **Circle Wallets** for user abstraction (no wallet management for companies)

**Target Prizes:**
1. 🏆 **Best Chain-Abstracted USDC Apps Using Arc as a Liquidity Hub** — $5,000
2. 🏆 **Build Global Payouts and Treasury Systems with USDC on Arc** — $2,500

**Required Circle Tools:** Arc, Circle Gateway, USDC, Circle Wallets, Bridge Kit

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SEED FINANCE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LIQUIDITY PROVIDERS                               │   │
│  │         (Deposit USDC from Ethereum, Polygon, Base, etc.)           │   │
│  └────────────────────────────┬────────────────────────────────────────┘   │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        ARC (Circle L1)                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                   LIQUIDITY HUB                              │   │   │
│  │  │  • Aggregates USDC from all chains                          │   │   │
│  │  │  • Single liquidity surface                                  │   │   │
│  │  │  • LP accounting & yield distribution                        │   │   │
│  │  │  • Routes capital to Sui on demand                          │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │               ARC SMART CONTRACTS (EVM)                      │   │   │
│  │  │  • LiquidityPool.sol — LP deposits, share tokens            │   │   │
│  │  │  • YieldVault.sol — ERC-4626 yield aggregation              │   │   │
│  │  │  • BridgeRouter.sol — Routes USDC to Sui                    │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────┬────────────────────────────────────────┘   │
│                               │                                              │
│              Cross-chain message (Wormhole / Circle CCTP)                   │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          SUI BLOCKCHAIN                              │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │               CREDIT EXECUTION LAYER (Move)                  │   │   │
│  │  │  • invoice.move — Invoice objects, lifecycle                │   │   │
│  │  │  • execution_pool.move — Temporary USDC holding             │   │   │
│  │  │  • payment_router.move — Funding & repayment logic          │   │   │
│  │  │  • credit_oracle.move — On-chain credit scoring             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────┬────────────────────────────────────────┘   │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CIRCLE GATEWAY                                  │   │
│  │  • On-ramp: Buyer fiat → USDC (for repayment)                      │   │
│  │  • Off-ramp: USDC → Supplier bank account                          │   │
│  │  • Abstracted settlement (companies never see crypto)              │   │
│  └────────────────────────────┬────────────────────────────────────────┘   │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CIRCLE WALLETS                                  │   │
│  │  • Programmable wallets for Buyer & Supplier                       │   │
│  │  • No private key management for end users                         │   │
│  │  • Policy-based transaction signing                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow — Complete Invoice Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        INVOICE LIFECYCLE FLOW                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  PHASE 1: LIQUIDITY PROVISIONING                                             │
│  ────────────────────────────────                                             │
│  LP (Ethereum) ──USDC──► Bridge Kit ──► Arc LiquidityPool                    │
│  LP (Polygon)  ──USDC──► Bridge Kit ──► Arc LiquidityPool                    │
│  LP (Base)     ──USDC──► Bridge Kit ──► Arc LiquidityPool                    │
│                                         │                                     │
│                                         ▼                                     │
│                              Arc aggregates as single pool                    │
│                              LP receives sfUSDC share tokens                  │
│                                                                               │
│  PHASE 2: INVOICE CREATION (on Sui)                                          │
│  ───────────────────────────────────                                          │
│  Supplier ──(via Circle Wallet)──► Sui: invoice::create()                    │
│                                    │                                          │
│                                    ▼                                          │
│                         Invoice Object Created                                │
│                         status: PENDING                                       │
│                                                                               │
│  PHASE 3: BUYER APPROVAL (on Sui)                                            │
│  ─────────────────────────────────                                            │
│  Buyer ──(via Circle Wallet)──► Sui: invoice::approve()                      │
│                                 │                                             │
│                                 ▼                                             │
│                      Invoice status: APPROVED                                 │
│                      Emits: InvoiceApproved event                            │
│                                                                               │
│  PHASE 4: FUNDING (Arc → Sui)                                                │
│  ────────────────────────────                                                 │
│  Backend detects InvoiceApproved event                                       │
│         │                                                                     │
│         ▼                                                                     │
│  Arc: BridgeRouter.routeToSui(amount, invoiceId)                             │
│         │                                                                     │
│         ▼ (CCTP / Wormhole)                                                  │
│  Sui: execution_pool::receive_funds()                                        │
│         │                                                                     │
│         ▼                                                                     │
│  Sui: payment_router::fund_invoice()                                         │
│         │                                                                     │
│         ▼                                                                     │
│  Invoice status: FUNDED                                                       │
│                                                                               │
│  PHASE 5: SUPPLIER PAYOUT                                                    │
│  ────────────────────────                                                     │
│  Sui: USDC transferred to Supplier's Circle Wallet                           │
│         │                                                                     │
│         ▼                                                                     │
│  Circle Gateway: Off-ramp USDC → Supplier's bank                             │
│         │                                                                     │
│         ▼                                                                     │
│  Supplier receives fiat (abstracted, no crypto UX)                           │
│                                                                               │
│  PHASE 6: BUYER REPAYMENT (at maturity)                                      │
│  ───────────────────────────────────────                                      │
│  Circle Gateway: Buyer's bank → USDC (on-ramp)                               │
│         │                                                                     │
│         ▼                                                                     │
│  Buyer's Circle Wallet receives USDC                                         │
│         │                                                                     │
│         ▼                                                                     │
│  Sui: payment_router::repay_invoice()                                        │
│         │                                                                     │
│         ▼                                                                     │
│  Invoice status: PAID                                                         │
│                                                                               │
│  PHASE 7: CAPITAL RETURN TO ARC                                              │
│  ───────────────────────────────                                              │
│  Sui: execution_pool::return_to_arc(amount + yield)                          │
│         │                                                                     │
│         ▼ (CCTP / Wormhole)                                                  │
│  Arc: LiquidityPool receives USDC + yield                                    │
│         │                                                                     │
│         ▼                                                                     │
│  LP share value increases (yield distributed)                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

### 1. Arc Smart Contracts (Solidity — EVM on Arc L1)

#### LiquidityPool.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SeedFinance Liquidity Pool
 * @notice ERC-4626 vault for USDC deposits on Arc
 * @dev LPs deposit USDC, receive sfUSDC shares, earn yield from invoice financing
 */
contract LiquidityPool is ERC4626, AccessControl {
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");

    // Tracking
    uint256 public totalDeployed;      // USDC currently on Sui
    uint256 public totalYieldEarned;   // Cumulative yield

    // Events
    event LiquidityRouted(uint256 amount, bytes32 invoiceId, uint64 suiDestination);
    event LiquidityReturned(uint256 principal, uint256 yield, bytes32 invoiceId);
    event YieldDistributed(uint256 amount, uint256 timestamp);

    constructor(
        IERC20 _usdc,
        string memory _name,
        string memory _symbol
    ) ERC4626(_usdc) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Route USDC to Sui for invoice funding
     * @param amount Amount of USDC to route
     * @param invoiceId Sui invoice object ID
     */
    function routeToSui(
        uint256 amount,
        bytes32 invoiceId
    ) external onlyRole(ROUTER_ROLE) returns (bool) {
        require(totalAssets() - totalDeployed >= amount, "Insufficient available liquidity");

        totalDeployed += amount;

        // Trigger CCTP/Bridge transfer to Sui
        // Integration point: Circle CCTP or Wormhole

        emit LiquidityRouted(amount, invoiceId, 0); // 0 = Sui chain ID placeholder
        return true;
    }

    /**
     * @notice Receive returned capital from Sui
     * @param principal Original amount
     * @param yield Earned yield
     * @param invoiceId Associated invoice
     */
    function receiveFromSui(
        uint256 principal,
        uint256 yield,
        bytes32 invoiceId
    ) external onlyRole(ROUTER_ROLE) {
        totalDeployed -= principal;
        totalYieldEarned += yield;

        emit LiquidityReturned(principal, yield, invoiceId);
    }

    /**
     * @notice Available liquidity for new invoices
     */
    function availableLiquidity() public view returns (uint256) {
        return totalAssets() - totalDeployed;
    }

    /**
     * @notice Current utilization rate (bps)
     */
    function utilizationRate() public view returns (uint256) {
        if (totalAssets() == 0) return 0;
        return (totalDeployed * 10000) / totalAssets();
    }
}
```

#### BridgeRouter.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LiquidityPool.sol";
import "@circle/cctp/interfaces/ITokenMessenger.sol";

/**
 * @title Bridge Router
 * @notice Routes USDC between Arc and Sui via Circle CCTP
 */
contract BridgeRouter {
    LiquidityPool public immutable pool;
    ITokenMessenger public immutable cctpMessenger;
    IERC20 public immutable usdc;

    // Sui domain for CCTP (placeholder - actual value TBD)
    uint32 public constant SUI_DOMAIN = 8;

    // Pending transfers
    mapping(bytes32 => PendingTransfer) public pendingTransfers;

    struct PendingTransfer {
        bytes32 invoiceId;
        uint256 amount;
        uint64 timestamp;
        TransferStatus status;
    }

    enum TransferStatus { Pending, Completed, Failed }

    event TransferInitiated(bytes32 indexed invoiceId, uint256 amount, bytes32 messageHash);
    event TransferCompleted(bytes32 indexed invoiceId, uint256 amount);

    constructor(
        address _pool,
        address _cctpMessenger,
        address _usdc
    ) {
        pool = LiquidityPool(_pool);
        cctpMessenger = ITokenMessenger(_cctpMessenger);
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Route USDC to Sui for invoice funding
     * @param invoiceId Sui invoice object ID
     * @param amount USDC amount
     * @param suiRecipient Recipient address on Sui (32 bytes)
     */
    function routeToSui(
        bytes32 invoiceId,
        uint256 amount,
        bytes32 suiRecipient
    ) external returns (bytes32 messageHash) {
        // Pull from pool
        require(pool.routeToSui(amount, invoiceId), "Pool route failed");

        // Approve CCTP
        usdc.approve(address(cctpMessenger), amount);

        // Send via CCTP
        uint64 nonce = cctpMessenger.depositForBurn(
            amount,
            SUI_DOMAIN,
            suiRecipient,
            address(usdc)
        );

        messageHash = keccak256(abi.encodePacked(nonce, invoiceId));

        pendingTransfers[messageHash] = PendingTransfer({
            invoiceId: invoiceId,
            amount: amount,
            timestamp: uint64(block.timestamp),
            status: TransferStatus.Pending
        });

        emit TransferInitiated(invoiceId, amount, messageHash);
    }

    /**
     * @notice Receive confirmation of Sui arrival
     * @dev Called by relayer/oracle after Sui confirms receipt
     */
    function confirmArrival(bytes32 messageHash) external {
        PendingTransfer storage transfer = pendingTransfers[messageHash];
        require(transfer.status == TransferStatus.Pending, "Invalid transfer");

        transfer.status = TransferStatus.Completed;
        emit TransferCompleted(transfer.invoiceId, transfer.amount);
    }
}
```

### 2. Sui Move Contracts

#### invoice.move

```move
module seed_finance::invoice {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};

    // === Errors ===
    const ENotBuyer: u64 = 1;
    const ENotSupplier: u64 = 2;
    const EInvalidStatus: u64 = 3;
    const ENotMature: u64 = 4;
    const EAlreadyFunded: u64 = 5;

    // === Structs ===

    /// Invoice object representing a payable
    struct Invoice has key, store {
        id: UID,
        // Parties
        buyer: address,
        supplier: address,
        // Financial terms
        face_value: u64,          // Amount in USDC (6 decimals)
        discount_rate_bps: u64,   // Early payment discount (basis points)
        maturity_date: u64,       // Unix timestamp
        // Metadata
        invoice_hash: vector<u8>, // IPFS CID of invoice document
        external_id: vector<u8>,  // External reference number
        // State
        status: u8,
        created_at: u64,
        funded_at: u64,
        paid_at: u64,
    }

    /// Invoice status constants
    const STATUS_PENDING: u8 = 0;
    const STATUS_APPROVED: u8 = 1;
    const STATUS_FUNDED: u8 = 2;
    const STATUS_PAID: u8 = 3;
    const STATUS_CANCELLED: u8 = 4;

    // === Events ===

    struct InvoiceCreated has copy, drop {
        invoice_id: address,
        buyer: address,
        supplier: address,
        face_value: u64,
        maturity_date: u64,
    }

    struct InvoiceApproved has copy, drop {
        invoice_id: address,
        buyer: address,
        approved_at: u64,
    }

    struct InvoiceFunded has copy, drop {
        invoice_id: address,
        amount_funded: u64,
        discount_applied: u64,
        funded_at: u64,
    }

    struct InvoicePaid has copy, drop {
        invoice_id: address,
        amount_paid: u64,
        paid_at: u64,
    }

    // === Public Functions ===

    /// Create a new invoice (called by supplier)
    public entry fun create(
        buyer: address,
        face_value: u64,
        discount_rate_bps: u64,
        maturity_date: u64,
        invoice_hash: vector<u8>,
        external_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let supplier = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock) / 1000;

        let invoice = Invoice {
            id: object::new(ctx),
            buyer,
            supplier,
            face_value,
            discount_rate_bps,
            maturity_date,
            invoice_hash,
            external_id,
            status: STATUS_PENDING,
            created_at: now,
            funded_at: 0,
            paid_at: 0,
        };

        let invoice_id = object::uid_to_address(&invoice.id);

        event::emit(InvoiceCreated {
            invoice_id,
            buyer,
            supplier,
            face_value,
            maturity_date,
        });

        // Transfer to shared object for accessibility
        transfer::share_object(invoice);
    }

    /// Approve invoice (called by buyer)
    public entry fun approve(
        invoice: &mut Invoice,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == invoice.buyer, ENotBuyer);
        assert!(invoice.status == STATUS_PENDING, EInvalidStatus);

        invoice.status = STATUS_APPROVED;

        event::emit(InvoiceApproved {
            invoice_id: object::uid_to_address(&invoice.id),
            buyer: invoice.buyer,
            approved_at: clock::timestamp_ms(clock) / 1000,
        });
    }

    /// Mark invoice as funded (called by execution pool)
    public fun mark_funded(
        invoice: &mut Invoice,
        amount_funded: u64,
        clock: &Clock,
    ) {
        assert!(invoice.status == STATUS_APPROVED, EInvalidStatus);

        let now = clock::timestamp_ms(clock) / 1000;
        invoice.status = STATUS_FUNDED;
        invoice.funded_at = now;

        let discount = calculate_discount(
            invoice.face_value,
            invoice.discount_rate_bps,
            invoice.maturity_date - now
        );

        event::emit(InvoiceFunded {
            invoice_id: object::uid_to_address(&invoice.id),
            amount_funded,
            discount_applied: discount,
            funded_at: now,
        });
    }

    /// Mark invoice as paid (called after buyer repayment)
    public fun mark_paid(
        invoice: &mut Invoice,
        amount_paid: u64,
        clock: &Clock,
    ) {
        assert!(invoice.status == STATUS_FUNDED, EInvalidStatus);

        let now = clock::timestamp_ms(clock) / 1000;
        invoice.status = STATUS_PAID;
        invoice.paid_at = now;

        event::emit(InvoicePaid {
            invoice_id: object::uid_to_address(&invoice.id),
            amount_paid,
            paid_at: now,
        });
    }

    // === View Functions ===

    public fun get_funding_amount(invoice: &Invoice, clock: &Clock): u64 {
        let now = clock::timestamp_ms(clock) / 1000;
        let days_to_maturity = (invoice.maturity_date - now) / 86400;
        let discount = calculate_discount(
            invoice.face_value,
            invoice.discount_rate_bps,
            days_to_maturity * 86400
        );
        invoice.face_value - discount
    }

    public fun status(invoice: &Invoice): u8 { invoice.status }
    public fun buyer(invoice: &Invoice): address { invoice.buyer }
    public fun supplier(invoice: &Invoice): address { invoice.supplier }
    public fun face_value(invoice: &Invoice): u64 { invoice.face_value }

    // === Internal Functions ===

    fun calculate_discount(face_value: u64, rate_bps: u64, seconds: u64): u64 {
        // Simple interest: discount = face_value * rate * time / (365 days)
        let annual_discount = (face_value * rate_bps) / 10000;
        (annual_discount * seconds) / 31536000 // seconds in a year
    }
}
```

#### execution_pool.move

```move
module seed_finance::execution_pool {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::clock::Clock;

    use seed_finance::invoice::{Self, Invoice};

    // USDC type (placeholder - use actual USDC type on Sui)
    struct USDC has drop {}

    // === Errors ===
    const EInsufficientBalance: u64 = 1;
    const EUnauthorized: u64 = 2;

    // === Structs ===

    /// Execution pool - temporary USDC holding on Sui
    struct ExecutionPool has key {
        id: UID,
        balance: Balance<USDC>,
        admin: address,
        // Tracking
        total_funded: u64,
        total_repaid: u64,
        active_invoices: u64,
    }

    /// Admin capability
    struct AdminCap has key, store {
        id: UID,
    }

    // === Events ===

    struct FundsReceived has copy, drop {
        amount: u64,
        from_chain: u8,  // 0 = Arc
        timestamp: u64,
    }

    struct InvoiceFundedEvent has copy, drop {
        invoice_id: address,
        supplier: address,
        amount: u64,
    }

    struct FundsReturnedToArc has copy, drop {
        amount: u64,
        yield_amount: u64,
        timestamp: u64,
    }

    // === Init ===

    fun init(ctx: &mut TxContext) {
        let admin = tx_context::sender(ctx);

        let pool = ExecutionPool {
            id: object::new(ctx),
            balance: balance::zero(),
            admin,
            total_funded: 0,
            total_repaid: 0,
            active_invoices: 0,
        };

        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        transfer::share_object(pool);
        transfer::transfer(admin_cap, admin);
    }

    // === Public Functions ===

    /// Receive USDC from Arc (called after bridge arrival)
    public entry fun receive_from_arc(
        pool: &mut ExecutionPool,
        funds: Coin<USDC>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let amount = coin::value(&funds);

        balance::join(&mut pool.balance, coin::into_balance(funds));

        event::emit(FundsReceived {
            amount,
            from_chain: 0, // Arc
            timestamp: sui::clock::timestamp_ms(clock) / 1000,
        });
    }

    /// Fund an approved invoice
    public entry fun fund_invoice(
        pool: &mut ExecutionPool,
        invoice: &mut Invoice,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Calculate funding amount (face value minus discount)
        let funding_amount = invoice::get_funding_amount(invoice, clock);

        assert!(balance::value(&pool.balance) >= funding_amount, EInsufficientBalance);

        // Extract USDC
        let payment = coin::from_balance(
            balance::split(&mut pool.balance, funding_amount),
            ctx
        );

        // Update invoice status
        invoice::mark_funded(invoice, funding_amount, clock);

        // Transfer to supplier
        let supplier = invoice::supplier(invoice);
        transfer::public_transfer(payment, supplier);

        // Update tracking
        pool.total_funded = pool.total_funded + funding_amount;
        pool.active_invoices = pool.active_invoices + 1;

        event::emit(InvoiceFundedEvent {
            invoice_id: object::uid_to_address(object::borrow_id(invoice)),
            supplier,
            amount: funding_amount,
        });
    }

    /// Receive repayment from buyer
    public entry fun receive_repayment(
        pool: &mut ExecutionPool,
        invoice: &mut Invoice,
        payment: Coin<USDC>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);

        balance::join(&mut pool.balance, coin::into_balance(payment));

        invoice::mark_paid(invoice, amount, clock);

        pool.total_repaid = pool.total_repaid + amount;
        pool.active_invoices = pool.active_invoices - 1;
    }

    /// Return funds to Arc (yield included)
    public entry fun return_to_arc(
        pool: &mut ExecutionPool,
        _admin: &AdminCap,
        amount: u64,
        yield_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let total = amount + yield_amount;
        assert!(balance::value(&pool.balance) >= total, EInsufficientBalance);

        let funds = coin::from_balance(
            balance::split(&mut pool.balance, total),
            ctx
        );

        // Send to bridge for Arc return
        // Integration: Wormhole / CCTP return path
        // For MVP: transfer to bridge address

        event::emit(FundsReturnedToArc {
            amount,
            yield_amount,
            timestamp: sui::clock::timestamp_ms(clock) / 1000,
        });

        // Placeholder: actual bridge integration
        transfer::public_transfer(funds, @bridge_address);
    }

    // === View Functions ===

    public fun available_balance(pool: &ExecutionPool): u64 {
        balance::value(&pool.balance)
    }

    public fun total_funded(pool: &ExecutionPool): u64 {
        pool.total_funded
    }
}
```

### 3. Backend Services

#### API Structure

```
/api
├── /invoices
│   ├── POST   /create          — Create new invoice
│   ├── GET    /                — List invoices (filtered by role)
│   ├── GET    /:id             — Get invoice details
│   ├── POST   /:id/approve     — Approve invoice (buyer)
│   └── POST   /:id/fund        — Trigger funding (internal)
│
├── /liquidity
│   ├── GET    /pool            — Get Arc pool stats
│   ├── POST   /deposit         — LP deposit (triggers Circle Wallet)
│   ├── POST   /withdraw        — LP withdrawal
│   └── GET    /yield           — Get yield metrics
│
├── /payments
│   ├── POST   /on-ramp         — Initiate fiat → USDC (Circle Gateway)
│   ├── POST   /off-ramp        — Initiate USDC → fiat (Circle Gateway)
│   └── GET    /status/:id      — Payment status
│
├── /users
│   ├── POST   /register        — Register user (creates Circle Wallet)
│   ├── GET    /profile         — Get user profile
│   └── GET    /wallet          — Get wallet balance
│
└── /webhooks
    ├── POST   /circle          — Circle Gateway webhooks
    ├── POST   /sui             — Sui event webhooks
    └── POST   /arc             — Arc event webhooks
```

#### Circle Integration Service

```typescript
// services/circle.ts

import { CircleClient } from '@circle-fin/circle-sdk';

interface CircleConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
}

export class CircleService {
  private client: CircleClient;

  constructor(config: CircleConfig) {
    this.client = new CircleClient({
      apiKey: config.apiKey,
      environment: config.environment,
    });
  }

  // === Circle Wallets ===

  async createWallet(userId: string, type: 'buyer' | 'supplier' | 'lp'): Promise<string> {
    const wallet = await this.client.wallets.create({
      idempotencyKey: `${userId}-${type}-${Date.now()}`,
      description: `Seed Finance ${type} wallet`,
      refId: userId,
    });
    return wallet.data.walletId;
  }

  async getWalletBalance(walletId: string): Promise<number> {
    const balances = await this.client.wallets.getBalance(walletId);
    const usdc = balances.data.balances.find(b => b.currency === 'USD');
    return usdc ? parseFloat(usdc.amount) : 0;
  }

  // === Circle Gateway (On/Off Ramp) ===

  async createOnRamp(params: {
    amount: number;
    buyerWalletId: string;
    bankAccountId: string;
  }): Promise<string> {
    const payment = await this.client.payments.create({
      idempotencyKey: `onramp-${Date.now()}`,
      amount: {
        amount: params.amount.toString(),
        currency: 'USD',
      },
      source: {
        type: 'wire',
        id: params.bankAccountId,
      },
      destination: {
        type: 'wallet',
        id: params.buyerWalletId,
      },
    });
    return payment.data.id;
  }

  async createOffRamp(params: {
    amount: number;
    supplierWalletId: string;
    bankAccountId: string;
  }): Promise<string> {
    const payout = await this.client.payouts.create({
      idempotencyKey: `offramp-${Date.now()}`,
      amount: {
        amount: params.amount.toString(),
        currency: 'USD',
      },
      source: {
        type: 'wallet',
        id: params.supplierWalletId,
      },
      destination: {
        type: 'wire',
        id: params.bankAccountId,
      },
    });
    return payout.data.id;
  }

  // === Arc Bridge Integration ===

  async routeToSui(params: {
    amount: number;
    invoiceId: string;
    suiPoolAddress: string;
  }): Promise<string> {
    // Use Circle CCTP for cross-chain transfer
    // Arc → Sui via CCTP
    const transfer = await this.client.crossChainTransfers.create({
      idempotencyKey: `route-${params.invoiceId}`,
      amount: {
        amount: params.amount.toString(),
        currency: 'USD',
      },
      sourceChain: 'ARC',
      destinationChain: 'SUI',
      destinationAddress: params.suiPoolAddress,
      metadata: {
        invoiceId: params.invoiceId,
      },
    });
    return transfer.data.id;
  }
}
```

### 4. Frontend Structure

```
/app (Next.js 14 App Router)
├── /                           — Landing page
├── /dashboard
│   ├── /buyer                  — Buyer dashboard
│   │   ├── /invoices           — View/approve invoices
│   │   ├── /repayments         — Manage repayments
│   │   └── /analytics          — Spending analytics
│   │
│   ├── /supplier               — Supplier dashboard
│   │   ├── /invoices           — Create/view invoices
│   │   ├── /funding            — Request early payment
│   │   └── /history            — Payment history
│   │
│   └── /financier              — LP dashboard
│       ├── /deposit            — Deposit USDC
│       ├── /portfolio          — View positions
│       └── /yield              — Yield analytics
│
├── /auth
│   ├── /login                  — Email/social login
│   └── /register               — Registration flow
│
└── /api                        — API routes
```

---

## USYC Treasury Yield Strategy

### Dual-Yield Architecture

Seed Finance implements a dual-yield strategy using USYC (Hashnote's tokenized US Treasury product) to maximize LP returns on idle capital.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DUAL-YIELD STRATEGY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: BASE YIELD (Treasury Rate)                                        │
│  ────────────────────────────────────                                        │
│  Idle USDC in Arc Pool                                                       │
│         │                                                                    │
│         ▼                                                                    │
│  Swap USDC → USYC (tokenized T-Bills)                                       │
│         │                                                                    │
│         ▼                                                                    │
│  Earn ~4-5% APY (risk-free Treasury rate)                                   │
│                                                                              │
│  LAYER 2: PROTOCOL YIELD (Invoice Financing)                                │
│  ────────────────────────────────────────────                                │
│  When invoice needs funding:                                                 │
│         │                                                                    │
│         ▼                                                                    │
│  Redeem USYC → USDC (instant liquidity)                                     │
│         │                                                                    │
│         ▼                                                                    │
│  Fund invoice, earn 4-10% financing spread                                  │
│                                                                              │
│  COMBINED YIELD                                                              │
│  ──────────────                                                              │
│  Base (USYC):     ~4-5% APY on idle funds                                   │
│  Protocol:        ~4-10% APY on deployed funds                              │
│  Blended:         ~8-14% APY (depending on utilization)                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Capital State Machine

```
                    ┌─────────────────┐
                    │   LP Deposits   │
                    │     USDC        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  IDLE STATE     │
                    │  USDC → USYC    │◄─────────────┐
                    │  (Earning ~4%)  │              │
                    └────────┬────────┘              │
                             │                       │
               Invoice approved                      │
                             │                       │
                             ▼                       │
                    ┌─────────────────┐              │
                    │ DEPLOYED STATE  │              │
                    │  USYC → USDC    │              │
                    │  Fund invoice   │              │
                    │ (Earning ~8%)   │              │
                    └────────┬────────┘              │
                             │                       │
               Invoice repaid                        │
                             │                       │
                             ▼                       │
                    ┌─────────────────┐              │
                    │   RETURNED      │              │
                    │ Principal+Yield │──────────────┘
                    └─────────────────┘
```

### Smart Contract: TreasuryManager.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IUSYC {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title Treasury Manager
 * @notice Manages idle USDC by depositing into USYC for Treasury yield
 * @dev Integrates with Hashnote's USYC for tokenized T-Bill exposure
 */
contract TreasuryManager is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant POOL_ROLE = keccak256("POOL_ROLE");

    IERC20 public immutable usdc;
    IUSYC public immutable usyc;

    // Minimum USDC to keep liquid (for immediate funding needs)
    uint256 public liquidityBuffer;

    // Tracking
    uint256 public totalDeposited;      // USDC deposited to USYC
    uint256 public totalYieldEarned;    // Cumulative Treasury yield

    // Events
    event DepositedToTreasury(uint256 usdcAmount, uint256 usycShares);
    event RedeemedFromTreasury(uint256 usycShares, uint256 usdcAmount);
    event YieldHarvested(uint256 yieldAmount);
    event LiquidityBufferUpdated(uint256 newBuffer);

    constructor(
        address _usdc,
        address _usyc,
        uint256 _liquidityBuffer
    ) {
        usdc = IERC20(_usdc);
        usyc = IUSYC(_usyc);
        liquidityBuffer = _liquidityBuffer;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Deposit idle USDC into USYC for Treasury yield
     * @param amount USDC amount to deposit
     */
    function depositToTreasury(uint256 amount) external onlyRole(POOL_ROLE) returns (uint256 shares) {
        require(amount > 0, "Amount must be > 0");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdc.approve(address(usyc), amount);

        shares = usyc.deposit(amount, address(this));
        totalDeposited += amount;

        emit DepositedToTreasury(amount, shares);
    }

    /**
     * @notice Redeem USYC to USDC for invoice funding
     * @param usdcNeeded Amount of USDC needed
     */
    function redeemForFunding(uint256 usdcNeeded) external onlyRole(POOL_ROLE) returns (uint256 actualUsdc) {
        uint256 sharesNeeded = usyc.convertToShares(usdcNeeded);
        uint256 sharesAvailable = usyc.balanceOf(address(this));

        require(sharesAvailable >= sharesNeeded, "Insufficient USYC balance");

        actualUsdc = usyc.redeem(sharesNeeded, msg.sender, address(this));

        // Calculate yield earned on this portion
        uint256 originalDeposit = (totalDeposited * sharesNeeded) / (sharesAvailable + sharesNeeded);
        if (actualUsdc > originalDeposit) {
            totalYieldEarned += (actualUsdc - originalDeposit);
        }
        totalDeposited -= originalDeposit;

        emit RedeemedFromTreasury(sharesNeeded, actualUsdc);
    }

    /**
     * @notice Get current USYC value in USDC terms
     */
    function getTreasuryValue() public view returns (uint256) {
        uint256 shares = usyc.balanceOf(address(this));
        return usyc.convertToAssets(shares);
    }

    /**
     * @notice Get unrealized yield (current value - deposited)
     */
    function getUnrealizedYield() public view returns (uint256) {
        uint256 currentValue = getTreasuryValue();
        if (currentValue > totalDeposited) {
            return currentValue - totalDeposited;
        }
        return 0;
    }

    /**
     * @notice Harvest yield without redeeming principal
     */
    function harvestYield() external onlyRole(POOL_ROLE) returns (uint256 yield) {
        yield = getUnrealizedYield();
        if (yield > 0) {
            uint256 yieldShares = usyc.convertToShares(yield);
            usyc.redeem(yieldShares, msg.sender, address(this));
            totalYieldEarned += yield;
            emit YieldHarvested(yield);
        }
    }

    /**
     * @notice Update liquidity buffer
     */
    function setLiquidityBuffer(uint256 newBuffer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidityBuffer = newBuffer;
        emit LiquidityBufferUpdated(newBuffer);
    }
}
```

### Updated LiquidityPool.sol (with USYC)

```solidity
// Key additions to LiquidityPool.sol

contract LiquidityPool is ERC4626, AccessControl {
    // ... existing code ...

    TreasuryManager public treasuryManager;

    // Auto-deposit threshold (deposit to USYC when idle > threshold)
    uint256 public autoDepositThreshold = 100_000 * 1e6; // 100k USDC

    /**
     * @notice Total assets including USYC position
     */
    function totalAssets() public view override returns (uint256) {
        uint256 liquidUsdc = usdc.balanceOf(address(this));
        uint256 treasuryValue = treasuryManager.getTreasuryValue();
        return liquidUsdc + treasuryValue - totalDeployed;
    }

    /**
     * @notice Available liquidity (liquid USDC + redeemable USYC)
     */
    function availableLiquidity() public view returns (uint256) {
        return totalAssets() - totalDeployed;
    }

    /**
     * @notice Optimize idle capital by depositing to USYC
     * @dev Called periodically by keeper or after deposits
     */
    function optimizeIdleCapital() external {
        uint256 liquidUsdc = usdc.balanceOf(address(this));
        uint256 buffer = treasuryManager.liquidityBuffer();

        if (liquidUsdc > buffer + autoDepositThreshold) {
            uint256 toDeposit = liquidUsdc - buffer;
            usdc.approve(address(treasuryManager), toDeposit);
            treasuryManager.depositToTreasury(toDeposit);
        }
    }

    /**
     * @notice Route to Sui, redeeming from USYC if needed
     */
    function routeToSui(
        uint256 amount,
        bytes32 invoiceId
    ) external onlyRole(ROUTER_ROLE) returns (bool) {
        uint256 liquidUsdc = usdc.balanceOf(address(this));

        // If not enough liquid USDC, redeem from USYC
        if (liquidUsdc < amount) {
            uint256 toRedeem = amount - liquidUsdc;
            treasuryManager.redeemForFunding(toRedeem);
        }

        totalDeployed += amount;
        emit LiquidityRouted(amount, invoiceId, 0);
        return true;
    }
}
```

### Yield Calculation Example

```
Scenario: $10M pool, 60% average utilization

IDLE CAPITAL ($4M):
├── Deposited in USYC
├── Treasury Rate: 4.5% APY
└── Annual Yield: $180,000

DEPLOYED CAPITAL ($6M):
├── Financing invoices
├── Protocol Spread: 8% APY (average)
└── Annual Yield: $480,000

TOTAL YIELD:
├── Combined: $660,000
├── Effective APY: 6.6% (blended)
└── LP Share (80%): $528,000 = 5.28% net APY

COMPARISON:
├── Pure DeFi Lending: 3-5% APY
├── Traditional SCF: 5-8% APY
└── Seed Finance: 5-8% APY (with Treasury backing)

ADVANTAGE: Risk-adjusted returns are higher because:
├── Idle funds earn risk-free Treasury rate
├── No opportunity cost on uninvested capital
└── LPs get yield even at low utilization
```

### Integration with Arc Ecosystem

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        ARC TREASURY INTEGRATION                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LP Deposit Flow:                                                           │
│  ────────────────                                                           │
│  USDC (any chain) → Bridge Kit → Arc LiquidityPool                         │
│                                      │                                      │
│                                      ▼                                      │
│                               TreasuryManager                               │
│                                      │                                      │
│                         ┌────────────┴────────────┐                        │
│                         │                         │                         │
│                         ▼                         ▼                         │
│                    Keep Buffer              Deposit to USYC                 │
│                    (liquid USDC)            (Treasury yield)                │
│                                                                             │
│  Invoice Funding Flow:                                                      │
│  ─────────────────────                                                      │
│  Invoice Approved → Check liquid USDC                                       │
│                         │                                                   │
│              ┌──────────┴──────────┐                                       │
│              │                     │                                        │
│         Sufficient            Insufficient                                  │
│              │                     │                                        │
│              ▼                     ▼                                        │
│         Use liquid            Redeem USYC                                   │
│           USDC                    │                                         │
│              │                     │                                        │
│              └──────────┬──────────┘                                       │
│                         │                                                   │
│                         ▼                                                   │
│                  Route to Sui (CCTP)                                        │
│                         │                                                   │
│                         ▼                                                   │
│                   Fund Invoice                                              │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **No Idle Capital** | Every dollar earns yield, even when not financing invoices |
| **Risk-Free Base** | Treasury rate is government-backed, minimal risk |
| **Instant Liquidity** | USYC redeems to USDC instantly for funding needs |
| **Competitive APY** | 8-14% combined vs 3-8% for pure DeFi |
| **Low Utilization Protection** | LPs earn even when few invoices are financed |

### USYC Contract Addresses (Mainnet)

```
Ethereum Mainnet:
├── USYC Token: 0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b
└── USYC Minter: [TBD based on Hashnote docs]

Arc (when available):
├── USYC Token: [To be deployed]
└── Integration via Circle ecosystem
```

---

## Development Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Set up monorepo (Turborepo)
- [ ] Deploy Arc contracts to testnet
- [ ] Deploy Sui contracts to devnet
- [ ] Set up Circle SDK integration
- [ ] Basic API structure

### Phase 2: Core Flow (Days 3-4)
- [ ] Invoice creation on Sui
- [ ] Invoice approval flow
- [ ] Arc → Sui bridge integration
- [ ] Invoice funding mechanism
- [ ] Circle Wallet integration

### Phase 3: Settlement (Day 5)
- [ ] Circle Gateway on-ramp (buyer repayment)
- [ ] Circle Gateway off-ramp (supplier payout)
- [ ] Sui → Arc return path
- [ ] Yield calculation and distribution

### Phase 4: Frontend (Day 6)
- [ ] Buyer dashboard
- [ ] Supplier dashboard
- [ ] Financier dashboard
- [ ] Wallet connection (RainbowKit for LPs)

### Phase 5: Polish (Day 7)
- [ ] End-to-end testing
- [ ] Demo video recording
- [ ] Architecture diagram
- [ ] Documentation
- [ ] Pitch deck

---

## Prize Qualification Checklist

### Best Chain-Abstracted USDC Apps ($5,000)

- [x] **Uses Arc as liquidity hub** — LPs deposit on Arc, unified pool
- [x] **Chain abstraction** — Capital flows Arc ↔ Sui seamlessly
- [x] **Cross-chain payments** — Reverse factoring is a payment/credit system
- [x] **Seamless UX** — Companies never see crypto (Circle Wallets + Gateway)
- [ ] **Functional MVP** — Working frontend + backend
- [ ] **Architecture diagram** — With Circle tool labels
- [ ] **Video demo** — 2-3 minutes

### Required Tools Evidence:
- **Arc**: LiquidityPool.sol deployed on Arc testnet
- **Circle Gateway**: On/off-ramp for fiat settlement
- **USDC**: All internal operations in USDC
- **Circle Wallets**: Programmable wallets for Buyer/Supplier

### Build Global Payouts ($2,500)

- [x] **Global payout system** — Supplier payouts worldwide
- [x] **Automated payout logic** — Smart contract triggers
- [x] **Multi-recipient** — Multiple suppliers per buyer
- [x] **Policy-based payouts** — Invoice approval = payout trigger
- [ ] **Bridge Kit integration** — For LP deposits from other chains

---

## Environment Variables

```env
# Circle
CIRCLE_API_KEY=
CIRCLE_ENVIRONMENT=sandbox

# Sui
SUI_RPC_URL=https://fullnode.devnet.sui.io
SUI_PRIVATE_KEY=

# Arc
ARC_RPC_URL=
ARC_PRIVATE_KEY=

# USYC (Treasury)
USYC_TOKEN_ADDRESS=0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b
USYC_LIQUIDITY_BUFFER=100000000000  # 100k USDC in 6 decimals

# Database
DATABASE_URL=postgresql://...

# Frontend
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_SUI_NETWORK=devnet
```

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-31 | Use Sui for invoice logic | Object model perfect for invoices, fast finality |
| 2026-01-31 | Use Arc for liquidity | Circle prize requirement, native USDC, EVM familiar |
| 2026-01-31 | Circle Wallets for companies | No wallet UX for business users |
| 2026-01-31 | CCTP for bridging | Circle's own bridge, best integration with Arc |
| 2026-01-31 | USYC for idle treasury | Dual-yield strategy: Treasury rate + invoice financing |

---

## One-Liner

> "Seed Finance is a non-custodial reverse factoring protocol with dual-yield strategy: idle USDC earns Treasury yield via USYC while deployed capital finances invoices — all chain-abstracted via Arc, executed on Sui, settled through Circle Gateway. Companies never touch crypto, LPs earn 8-14% APY."

---

**Last Updated:** 2026-01-31
**Status:** Ready for implementation
