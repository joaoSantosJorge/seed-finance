# Seed Finance — Technical Implementation Guide

> **This document is the single source of truth for building Seed Finance.**
> Claude: Always read this before implementing any feature.
> before writing code, write the plan in a file and put it in /development. Then follow the steps on the file
> before commit and push, run tests

---

## Project Overview

**Seed Finance** is a decentralized reverse factoring protocol built on **Base L2**:
- **Single-chain deployment** on Base for maximum simplicity and speed to market
- Uses **Circle Gateway** for fiat on/off-ramp settlement
- Uses **Circle Wallets** for user abstraction (no wallet management for companies)
- Uses **CCTP** for cross-chain LP deposits (optional, Phase 2)

**Architecture Decision:** We chose Base-only deployment over dual-chain (Arc + Base) for production because:
- 2-3x faster development time
- 50% reduction in audit scope
- Eliminates bridge risk entirely
- All Circle tools (Gateway, Wallets) work natively on Base
- Can add multi-chain LP deposits via CCTP in Phase 2 if needed

See `docs/01_architecture_analysis.md` for the full analysis.

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SEED FINANCE ARCHITECTURE (BASE-ONLY)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LIQUIDITY PROVIDERS                               │   │
│  │                   (Deposit USDC on Base)                            │   │
│  └────────────────────────────┬────────────────────────────────────────┘   │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        BASE L2 (Coinbase)                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                   LIQUIDITY LAYER                            │   │   │
│  │  │  • LiquidityPool.sol — ERC-4626 vault for LP deposits       │   │   │
│  │  │  • TreasuryManager.sol — USYC yield optimization (optional) │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                 CREDIT EXECUTION LAYER                       │   │   │
│  │  │  • InvoiceRegistry.sol — Invoice lifecycle management       │   │   │
│  │  │  • ExecutionPool.sol — USDC holding for funding             │   │   │
│  │  │  • PaymentRouter.sol — Funding & repayment logic            │   │   │
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
│  LP deposits USDC directly to Base LiquidityPool                             │
│         │                                                                     │
│         ▼                                                                     │
│  LP receives sfUSDC share tokens (ERC-4626)                                  │
│                                                                               │
│  PHASE 2: INVOICE CREATION (on Base)                                         │
│  ────────────────────────────────────                                         │
│  Supplier ──(via Circle Wallet)──► Base: InvoiceRegistry.create()            │
│                                    │                                          │
│                                    ▼                                          │
│                         Invoice Created                                       │
│                         status: PENDING                                       │
│                                                                               │
│  PHASE 3: BUYER APPROVAL (on Base)                                           │
│  ──────────────────────────────────                                           │
│  Buyer ──(via Circle Wallet)──► Base: InvoiceRegistry.approve()              │
│                                 │                                             │
│                                 ▼                                             │
│                      Invoice status: APPROVED                                 │
│                      Emits: InvoiceApproved event                            │
│                                                                               │
│  PHASE 4: FUNDING (on Base)                                                  │
│  ──────────────────────────                                                   │
│  Backend detects InvoiceApproved event                                       │
│         │                                                                     │
│         ▼                                                                     │
│  Base: PaymentRouter.requestFunding(invoiceId)                               │
│         │                                                                     │
│         ▼                                                                     │
│  LiquidityPool transfers USDC to ExecutionPool                               │
│         │                                                                     │
│         ▼                                                                     │
│  ExecutionPool.fundInvoice() → USDC to Supplier                              │
│         │                                                                     │
│         ▼                                                                     │
│  Invoice status: FUNDED                                                       │
│                                                                               │
│  PHASE 5: SUPPLIER PAYOUT                                                    │
│  ────────────────────────                                                     │
│  Base: USDC transferred to Supplier's Circle Wallet                          │
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
│  Base: PaymentRouter.processRepayment(invoiceId)                             │
│         │                                                                     │
│         ▼                                                                     │
│  Invoice status: PAID                                                         │
│                                                                               │
│  PHASE 7: YIELD DISTRIBUTION                                                 │
│  ───────────────────────────                                                  │
│  Repayment (faceValue) returned to LiquidityPool                             │
│         │                                                                     │
│         ▼                                                                     │
│  Yield = faceValue - fundingAmount                                           │
│  LP share value increases automatically (ERC-4626)                           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Specifications

### Base Network Configuration

| Property | Testnet (Sepolia) | Mainnet |
|----------|-------------------|---------|
| **Chain ID** | 84532 | 8453 |
| **RPC Endpoint** | https://sepolia.base.org | https://mainnet.base.org |
| **Explorer** | https://sepolia.basescan.org | https://basescan.org |
| **USDC Address** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **USDC Decimals** | 6 | 6 |
| **CCTP Domain ID** | 6 | 6 |

**Key Features:**
- Native USDC (not bridged)
- ~$0.001 per transaction
- ~2 second finality
- 87% of ERC-4337 activity (account abstraction leader)
- Circle Wallets + Gateway work natively

### Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| **USDC** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **CCTP TokenMessenger** | `0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5` |
| **CCTP MessageTransmitter** | `0x7865fAfC2db2093669d92c0F33AeEF291086BEFD` |

### Smart Contract Development (Foundry)

```bash
# Install Foundry (https://getfoundry.sh/)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# In /contracts directory
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts

# Build & Test
forge build        # Compile contracts
forge test         # Run tests
forge test -vvv    # Verbose output
forge script       # Run deployment scripts

# Configuration in foundry.toml:
# - Solidity 0.8.26
# - Optimizer enabled (200 runs)
# - via_ir enabled for production
# - EVM version: cancun
```

### Circle SDK Packages (Backend)

```bash
# Core packages for backend Circle integration
npm install @circle-fin/developer-controlled-wallets  # Wallets SDK
npm install @circle-fin/smart-contract-platform       # Contracts SDK
npm install ethers@^6.0.0                             # Ethereum library
```

---

## Smart Contracts

### Contract Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BASE L2 CONTRACTS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    LiquidityPool.sol (ERC-4626)                         │ │
│  │  • LP deposits USDC, receives sfUSDC shares                            │ │
│  │  • Tracks deployed capital vs available liquidity                      │ │
│  │  • Automatic yield distribution via share price increase               │ │
│  │  • Optional: USYC treasury integration for idle capital yield          │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    InvoiceRegistry.sol                                  │ │
│  │  • Invoice CRUD operations                                             │ │
│  │  • Status lifecycle (PENDING → APPROVED → FUNDED → PAID)               │ │
│  │  • Access control (buyer, supplier modifiers)                          │ │
│  │  • Events for backend integration                                      │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    ExecutionPool.sol                                    │ │
│  │  • Receives USDC from LiquidityPool for funding                        │ │
│  │  • Funds approved invoices                                             │ │
│  │  • Receives repayments from buyers                                     │ │
│  │  • Returns capital + yield to LiquidityPool                            │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    PaymentRouter.sol                                    │ │
│  │  • Orchestrates funding requests                                       │ │
│  │  • Processes repayments                                                │ │
│  │  • Coordinates between all contracts                                   │ │
│  │  • Protocol fee management                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    TreasuryManager.sol (Optional - Phase 2)            │ │
│  │  • Deposits idle USDC to USYC for Treasury yield                       │ │
│  │  • Redeems USYC instantly when funding needed                          │ │
│  │  • Dual-yield: Treasury rate on idle + invoice spread on deployed      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Contract Project Structure

```
contracts/
├── foundry.toml                 # Foundry configuration
├── src/
│   ├── base/                    # Core contracts
│   │   ├── LiquidityPool.sol    # ERC-4626 vault (IMPLEMENTED)
│   │   └── TreasuryManager.sol  # Multi-strategy manager (IMPLEMENTED)
│   ├── interfaces/
│   │   └── ITreasuryStrategy.sol # Strategy interface
│   └── strategies/
│       ├── BaseTreasuryStrategy.sol  # Abstract base
│       └── USYCStrategy.sol          # USYC yield strategy
├── test/
│   ├── LiquidityPool.t.sol      # Pool tests
│   ├── TreasuryManager.t.sol    # Manager tests
│   └── mocks/
│       ├── MockUSDC.sol
│       └── MockStrategy.sol
└── lib/
    ├── forge-std/
    └── openzeppelin-contracts/
```

### Deployment Order

1. Deploy `InvoiceRegistry.sol`
2. Deploy `LiquidityPool.sol` (pass USDC address)
3. Deploy `TreasuryManager.sol` (pass USDC, LiquidityPool addresses)
4. Deploy `ExecutionPool.sol` (pass USDC, InvoiceRegistry addresses)
5. Deploy `PaymentRouter.sol` (pass InvoiceRegistry, ExecutionPool, LiquidityPool)
6. Configure access control roles and link contracts

### 1. LiquidityPool.sol — ERC-4626 Vault

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SeedFinance Liquidity Pool
 * @notice ERC-4626 vault for USDC deposits on Base
 * @dev LPs deposit USDC, receive sfUSDC shares, earn yield from invoice financing
 */
contract LiquidityPool is ERC4626, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");

    // Tracking
    uint256 public totalDeployed;      // USDC currently funding invoices
    uint256 public totalYieldEarned;   // Cumulative yield

    // Events
    event LiquidityDeployed(uint256 amount, uint256 invoiceId);
    event LiquidityReturned(uint256 principal, uint256 yield, uint256 invoiceId);
    event YieldDistributed(uint256 amount, uint256 timestamp);

    constructor(
        IERC20 _usdc,
        string memory _name,
        string memory _symbol
    ) ERC4626(_usdc) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Deploy USDC for invoice funding
     * @param amount Amount of USDC to deploy
     * @param invoiceId Invoice ID being funded
     */
    function deployForFunding(
        uint256 amount,
        uint256 invoiceId
    ) external onlyRole(ROUTER_ROLE) returns (bool) {
        require(availableLiquidity() >= amount, "Insufficient available liquidity");

        totalDeployed += amount;

        // Transfer USDC to caller (ExecutionPool)
        IERC20(asset()).safeTransfer(msg.sender, amount);

        emit LiquidityDeployed(amount, invoiceId);
        return true;
    }

    /**
     * @notice Receive returned capital from invoice repayment
     * @param principal Original amount deployed
     * @param yield Earned yield (faceValue - fundingAmount)
     * @param invoiceId Associated invoice
     */
    function receiveRepayment(
        uint256 principal,
        uint256 yield,
        uint256 invoiceId
    ) external onlyRole(ROUTER_ROLE) {
        totalDeployed -= principal;
        totalYieldEarned += yield;

        // USDC already transferred to this contract by caller

        emit LiquidityReturned(principal, yield, invoiceId);
    }

    /**
     * @notice Available liquidity for new invoices
     */
    function availableLiquidity() public view returns (uint256) {
        return totalAssets() - totalDeployed;
    }

    /**
     * @notice Current utilization rate (basis points)
     */
    function utilizationRate() public view returns (uint256) {
        if (totalAssets() == 0) return 0;
        return (totalDeployed * 10000) / totalAssets();
    }

    /**
     * @notice Total assets (override to account for deployed capital)
     * @dev Deployed capital is still part of total assets (it will return with yield)
     */
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + totalDeployed;
    }
}
```

### 2. InvoiceRegistry.sol — Invoice Lifecycle

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Invoice Registry
 * @notice Manages invoice lifecycle on Base
 */
contract InvoiceRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // Invoice status enum
    enum InvoiceStatus { Pending, Approved, Funded, Paid, Cancelled }

    // Invoice struct
    struct Invoice {
        uint256 id;
        address buyer;
        address supplier;
        uint256 faceValue;          // Amount in USDC (6 decimals on Base)
        uint256 discountRateBps;    // Early payment discount (basis points)
        uint256 maturityDate;       // Unix timestamp
        bytes32 invoiceHash;        // IPFS CID of invoice document
        bytes32 externalId;         // External reference number
        InvoiceStatus status;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 paidAt;
    }

    // Storage
    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) public supplierInvoices;
    mapping(address => uint256[]) public buyerInvoices;

    // Events
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed buyer,
        address indexed supplier,
        uint256 faceValue,
        uint256 maturityDate
    );
    event InvoiceApproved(uint256 indexed invoiceId, address indexed buyer, uint256 approvedAt);
    event InvoiceFunded(uint256 indexed invoiceId, uint256 amountFunded, uint256 discountApplied, uint256 fundedAt);
    event InvoicePaid(uint256 indexed invoiceId, uint256 amountPaid, uint256 paidAt);
    event InvoiceCancelled(uint256 indexed invoiceId, address cancelledBy, uint256 cancelledAt);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Create a new invoice (called by supplier)
     */
    function createInvoice(
        address buyer,
        uint256 faceValue,
        uint256 discountRateBps,
        uint256 maturityDate,
        bytes32 invoiceHash,
        bytes32 externalId
    ) external nonReentrant returns (uint256 invoiceId) {
        require(buyer != address(0), "Invalid buyer");
        require(buyer != msg.sender, "Buyer cannot be supplier");
        require(faceValue > 0, "Face value must be > 0");
        require(maturityDate > block.timestamp, "Maturity must be in future");
        require(discountRateBps <= 10000, "Discount rate too high");

        invoiceId = nextInvoiceId++;

        invoices[invoiceId] = Invoice({
            id: invoiceId,
            buyer: buyer,
            supplier: msg.sender,
            faceValue: faceValue,
            discountRateBps: discountRateBps,
            maturityDate: maturityDate,
            invoiceHash: invoiceHash,
            externalId: externalId,
            status: InvoiceStatus.Pending,
            createdAt: block.timestamp,
            fundedAt: 0,
            paidAt: 0
        });

        supplierInvoices[msg.sender].push(invoiceId);
        buyerInvoices[buyer].push(invoiceId);

        emit InvoiceCreated(invoiceId, buyer, msg.sender, faceValue, maturityDate);
    }

    /**
     * @notice Approve invoice (called by buyer)
     */
    function approveInvoice(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.id != 0, "Invoice does not exist");
        require(msg.sender == invoice.buyer, "Only buyer can approve");
        require(invoice.status == InvoiceStatus.Pending, "Invalid status");

        invoice.status = InvoiceStatus.Approved;

        emit InvoiceApproved(invoiceId, msg.sender, block.timestamp);
    }

    /**
     * @notice Mark invoice as funded (called by ExecutionPool)
     */
    function markFunded(
        uint256 invoiceId,
        uint256 amountFunded
    ) external onlyRole(EXECUTOR_ROLE) {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.status == InvoiceStatus.Approved, "Invoice not approved");

        invoice.status = InvoiceStatus.Funded;
        invoice.fundedAt = block.timestamp;

        uint256 discount = calculateDiscount(
            invoice.faceValue,
            invoice.discountRateBps,
            invoice.maturityDate - block.timestamp
        );

        emit InvoiceFunded(invoiceId, amountFunded, discount, block.timestamp);
    }

    /**
     * @notice Mark invoice as paid (called by PaymentRouter)
     */
    function markPaid(uint256 invoiceId, uint256 amountPaid) external onlyRole(EXECUTOR_ROLE) {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.status == InvoiceStatus.Funded, "Invoice not funded");

        invoice.status = InvoiceStatus.Paid;
        invoice.paidAt = block.timestamp;

        emit InvoicePaid(invoiceId, amountPaid, block.timestamp);
    }

    /**
     * @notice Cancel invoice (only if pending)
     */
    function cancelInvoice(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.id != 0, "Invoice does not exist");
        require(
            msg.sender == invoice.buyer || msg.sender == invoice.supplier,
            "Not authorized"
        );
        require(invoice.status == InvoiceStatus.Pending, "Can only cancel pending invoices");

        invoice.status = InvoiceStatus.Cancelled;

        emit InvoiceCancelled(invoiceId, msg.sender, block.timestamp);
    }

    // === View Functions ===

    /**
     * @notice Calculate funding amount (face value minus discount)
     */
    function getFundingAmount(uint256 invoiceId) public view returns (uint256) {
        Invoice storage invoice = invoices[invoiceId];
        uint256 secondsToMaturity = invoice.maturityDate > block.timestamp
            ? invoice.maturityDate - block.timestamp
            : 0;
        uint256 discount = calculateDiscount(
            invoice.faceValue,
            invoice.discountRateBps,
            secondsToMaturity
        );
        return invoice.faceValue - discount;
    }

    /**
     * @notice Get invoice details
     */
    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        return invoices[invoiceId];
    }

    /**
     * @notice Get supplier's invoices
     */
    function getSupplierInvoices(address supplier) external view returns (uint256[] memory) {
        return supplierInvoices[supplier];
    }

    /**
     * @notice Get buyer's invoices
     */
    function getBuyerInvoices(address buyer) external view returns (uint256[] memory) {
        return buyerInvoices[buyer];
    }

    // === Internal Functions ===

    function calculateDiscount(
        uint256 faceValue,
        uint256 rateBps,
        uint256 seconds_
    ) internal pure returns (uint256) {
        // Simple interest: discount = face_value * rate * time / (365 days)
        uint256 annualDiscount = (faceValue * rateBps) / 10000;
        return (annualDiscount * seconds_) / 365 days;
    }
}
```

### 3. ExecutionPool.sol — USDC Holding

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./InvoiceRegistry.sol";
import "./LiquidityPool.sol";

/**
 * @title Execution Pool
 * @notice USDC holding for invoice funding on Base
 * @dev Receives USDC from LiquidityPool, funds invoices, processes repayments
 */
contract ExecutionPool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable usdc;
    InvoiceRegistry public immutable invoiceRegistry;
    LiquidityPool public immutable liquidityPool;

    // Tracking
    uint256 public totalFunded;
    uint256 public totalRepaid;
    uint256 public activeInvoices;

    // Events
    event InvoiceFunded(uint256 indexed invoiceId, address indexed supplier, uint256 amount);
    event RepaymentReceived(uint256 indexed invoiceId, address indexed buyer, uint256 amount);
    event YieldReturned(uint256 indexed invoiceId, uint256 principal, uint256 yield);

    constructor(
        address _usdc,
        address _invoiceRegistry,
        address _liquidityPool
    ) {
        usdc = IERC20(_usdc);
        invoiceRegistry = InvoiceRegistry(_invoiceRegistry);
        liquidityPool = LiquidityPool(_liquidityPool);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Fund an approved invoice
     * @param invoiceId The invoice to fund
     */
    function fundInvoice(uint256 invoiceId) external onlyRole(ROUTER_ROLE) nonReentrant {
        InvoiceRegistry.Invoice memory invoice = invoiceRegistry.getInvoice(invoiceId);
        require(invoice.status == InvoiceRegistry.InvoiceStatus.Approved, "Invoice not approved");

        uint256 fundingAmount = invoiceRegistry.getFundingAmount(invoiceId);

        // Get USDC from liquidity pool
        require(liquidityPool.deployForFunding(fundingAmount, invoiceId), "Pool deploy failed");

        // Update invoice status
        invoiceRegistry.markFunded(invoiceId, fundingAmount);

        // Transfer to supplier
        usdc.safeTransfer(invoice.supplier, fundingAmount);

        // Update tracking
        totalFunded += fundingAmount;
        activeInvoices++;

        emit InvoiceFunded(invoiceId, invoice.supplier, fundingAmount);
    }

    /**
     * @notice Receive repayment from buyer
     * @param invoiceId The invoice being repaid
     */
    function receiveRepayment(uint256 invoiceId) external nonReentrant {
        InvoiceRegistry.Invoice memory invoice = invoiceRegistry.getInvoice(invoiceId);
        require(invoice.status == InvoiceRegistry.InvoiceStatus.Funded, "Invoice not funded");
        require(msg.sender == invoice.buyer, "Only buyer can repay");

        uint256 repaymentAmount = invoice.faceValue;

        // Transfer USDC from buyer
        usdc.safeTransferFrom(msg.sender, address(this), repaymentAmount);

        // Update invoice status
        invoiceRegistry.markPaid(invoiceId, repaymentAmount);

        // Calculate yield (difference between face value and funding amount)
        uint256 fundingAmount = invoiceRegistry.getFundingAmount(invoiceId);
        uint256 yield = repaymentAmount - fundingAmount;

        // Return to liquidity pool
        usdc.safeTransfer(address(liquidityPool), repaymentAmount);
        liquidityPool.receiveRepayment(fundingAmount, yield, invoiceId);

        // Update tracking
        totalRepaid += repaymentAmount;
        activeInvoices--;

        emit RepaymentReceived(invoiceId, msg.sender, repaymentAmount);
        emit YieldReturned(invoiceId, fundingAmount, yield);
    }

    // === View Functions ===

    function availableBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getTotalFunded() external view returns (uint256) {
        return totalFunded;
    }

    function getTotalRepaid() external view returns (uint256) {
        return totalRepaid;
    }

    function getActiveInvoices() external view returns (uint256) {
        return activeInvoices;
    }
}
```

### 4. PaymentRouter.sol — Orchestration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./InvoiceRegistry.sol";
import "./ExecutionPool.sol";

/**
 * @title Payment Router
 * @notice Orchestrates funding and repayment flows
 * @dev Coordinates between InvoiceRegistry and ExecutionPool
 */
contract PaymentRouter is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    InvoiceRegistry public immutable invoiceRegistry;
    ExecutionPool public immutable executionPool;

    // Fee configuration (basis points)
    uint256 public protocolFeeBps = 200; // 2%
    address public feeRecipient;

    // Events
    event FundingRequested(uint256 indexed invoiceId, uint256 amount);
    event RepaymentProcessed(uint256 indexed invoiceId, uint256 amount);
    event ProtocolFeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    constructor(
        address _invoiceRegistry,
        address _executionPool,
        address _feeRecipient
    ) {
        invoiceRegistry = InvoiceRegistry(_invoiceRegistry);
        executionPool = ExecutionPool(_executionPool);
        feeRecipient = _feeRecipient;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @notice Request funding for an approved invoice
     * @dev Called by backend after detecting InvoiceApproved event
     */
    function requestFunding(uint256 invoiceId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        InvoiceRegistry.Invoice memory invoice = invoiceRegistry.getInvoice(invoiceId);
        require(invoice.status == InvoiceRegistry.InvoiceStatus.Approved, "Invoice not approved");

        uint256 fundingAmount = invoiceRegistry.getFundingAmount(invoiceId);

        // Trigger funding from execution pool
        executionPool.fundInvoice(invoiceId);

        emit FundingRequested(invoiceId, fundingAmount);
    }

    /**
     * @notice Process repayment for a funded invoice
     * @dev Buyer calls this to repay at maturity
     */
    function processRepayment(uint256 invoiceId) external nonReentrant {
        InvoiceRegistry.Invoice memory invoice = invoiceRegistry.getInvoice(invoiceId);
        require(invoice.status == InvoiceRegistry.InvoiceStatus.Funded, "Invoice not funded");
        require(msg.sender == invoice.buyer, "Only buyer can repay");

        uint256 repaymentAmount = invoice.faceValue;

        // Process through execution pool
        executionPool.receiveRepayment(invoiceId);

        emit RepaymentProcessed(invoiceId, repaymentAmount);
    }

    /**
     * @notice Batch fund multiple invoices
     */
    function batchFund(uint256[] calldata invoiceIds) external onlyRole(OPERATOR_ROLE) nonReentrant {
        for (uint256 i = 0; i < invoiceIds.length; i++) {
            InvoiceRegistry.Invoice memory invoice = invoiceRegistry.getInvoice(invoiceIds[i]);
            if (invoice.status == InvoiceRegistry.InvoiceStatus.Approved) {
                executionPool.fundInvoice(invoiceIds[i]);
                emit FundingRequested(invoiceIds[i], invoiceRegistry.getFundingAmount(invoiceIds[i]));
            }
        }
    }

    // === Admin Functions ===

    function setProtocolFee(uint256 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }
}
```

---

## Backend Services

### API Structure

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
│   ├── GET    /pool            — Get pool stats
│   ├── POST   /deposit         — LP deposit
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
    └── POST   /base            — Base event webhooks
```

### Circle Integration Service

```typescript
// services/circle.ts

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

interface CircleConfig {
  apiKey: string;
  entitySecret: string;
}

export class CircleService {
  private client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;

  constructor(config: CircleConfig) {
    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: config.apiKey,
      entitySecret: config.entitySecret,
    });
  }

  // === Circle Wallets ===

  async createWallet(userId: string, type: 'buyer' | 'supplier' | 'lp'): Promise<string> {
    const walletSet = await this.client.createWalletSet({
      name: `${type}-${userId}`,
    });

    const wallets = await this.client.createWallets({
      blockchains: ['BASE-SEPOLIA'],
      count: 1,
      walletSetId: walletSet.data?.walletSet?.id,
      accountType: 'SCA', // Smart Contract Account
    });

    return wallets.data?.wallets?.[0]?.id || '';
  }

  async getWalletBalance(walletId: string): Promise<number> {
    const response = await this.client.getWalletTokenBalance({ id: walletId });
    const usdc = response.data?.tokenBalances?.find(b => b.token?.symbol === 'USDC');
    return usdc ? parseFloat(usdc.amount || '0') : 0;
  }

  // === Circle Gateway (On/Off Ramp) ===

  async createOnRamp(params: {
    amount: number;
    buyerWalletId: string;
    bankAccountId: string;
  }): Promise<string> {
    // Implementation for fiat → USDC
    // Uses Circle Gateway API
    return 'payment-id';
  }

  async createOffRamp(params: {
    amount: number;
    supplierWalletId: string;
    bankAccountId: string;
  }): Promise<string> {
    // Implementation for USDC → fiat
    // Uses Circle Gateway API
    return 'payout-id';
  }
}
```

---

## Frontend Structure

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

## Development Phases

### Phase 1: MVP (2-3 weeks)
- [ ] Set up monorepo (Turborepo)
- [ ] Deploy Base contracts to Sepolia
- [ ] Set up Circle SDK integration
- [ ] Basic API structure
- [ ] Invoice creation + approval flow
- [ ] LP deposit/withdraw flow
- [ ] Circle Wallet integration
- [ ] Frontend dashboards

### Phase 2: Production Polish (2-3 weeks)
- [ ] Circle Gateway integration (fiat on/off-ramp)
- [ ] TreasuryManager for USYC yield (optional)
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Mainnet deployment

### Phase 3: Multi-Chain Expansion (If Needed)
- [ ] Add CCTP integration for Ethereum/Arbitrum LPs
- [ ] Consider Arc as aggregation layer (only if LP demand justifies complexity)

---

## Environment Variables

```env
# Circle API
CIRCLE_API_KEY=TEST_API_KEY:xxx:yyy  # Environment-prefixed key from Circle Console
CIRCLE_ENTITY_SECRET=                 # 64-char alphanumeric entity secret

# Base Network
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_MAINNET_CHAIN_ID=8453

# Contract Addresses (Base Sepolia)
BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_CCTP_TOKEN_MESSENGER=0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
BASE_CCTP_MESSAGE_TRANSMITTER=0x7865fAfC2db2093669d92c0F33AeEF291086BEFD

# Seed Finance Contracts (after deployment)
BASE_LIQUIDITY_POOL_ADDRESS=
BASE_INVOICE_REGISTRY_ADDRESS=
BASE_EXECUTION_POOL_ADDRESS=
BASE_PAYMENT_ROUTER_ADDRESS=

# USYC (Treasury - Optional Phase 2)
USYC_TOKEN_ADDRESS=0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b
USYC_LIQUIDITY_BUFFER=100000000000  # 100k USDC (6 decimals on Base)

# Circle Wallet IDs (from Circle Console)
BASE_SEPOLIA_WALLET_ID=

# Database
DATABASE_URL=postgresql://...

# Frontend
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_CHAIN_ID=84532

# Explorer
BASESCAN_API_KEY=
```

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-31 | Base-only architecture | Simpler, faster to ship, lower risk, all Circle tools work natively |
| 2026-01-31 | ERC-4626 for LP vault | Standard interface, automatic yield distribution via share price |
| 2026-01-31 | Circle Wallets for companies | No wallet UX for business users |
| 2026-01-31 | Circle Gateway for fiat | Seamless fiat on/off-ramp integration |
| 2026-01-31 | USDC 6 decimals | Standard on Base (vs 18 on Arc) |
| 2026-01-31 | USYC treasury optional | Can add later if utilization is low, not critical for MVP |
| 2026-01-31 | Skip Arc for production | Arc was hackathon-driven, not needed for core product value |
| 2026-01-31 | Foundry over Hardhat | Better for pure Solidity projects, faster compilation, built-in fuzzing, superior testing DX |

---

## One-Liner

> "Seed Finance is a non-custodial reverse factoring protocol on Base: LPs deposit USDC to an ERC-4626 vault, suppliers get early payment on approved invoices, buyers repay at maturity via Circle Gateway. Companies never touch crypto, LPs earn 5-10% APY from financing spreads."

---

**Last Updated:** 2026-01-31
**Status:** Ready for implementation

---

## Reference Documentation

### Base / Circle
- **Base Network Details:** See `docs/BASE-REFERENCE.md` for complete Base reference
- **Base Docs:** https://docs.base.org
- **Base Explorer (Testnet):** https://sepolia.basescan.org
- **Base Explorer (Mainnet):** https://basescan.org
- **Base Faucet:** https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- **Circle Developer Console:** https://console.circle.com
- **Circle Gateway API:** https://developers.circle.com/gateway
- **Circle Wallets Docs:** https://developers.circle.com/wallets

### Architecture Analysis
- **Why Base-Only:** See `docs/01_architecture_analysis.md` for full analysis
