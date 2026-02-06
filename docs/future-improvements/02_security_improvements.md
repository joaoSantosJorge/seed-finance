# 02. Security Improvements

## Executive Summary

This document identifies critical and high-severity security issues in the Seed Finance codebase and provides detailed remediation strategies. Security improvements are categorized by severity and include specific code changes, testing requirements, and audit recommendations.

---

## Table of Contents

1. [Critical Security Issues](#critical-security-issues)
2. [High-Severity Issues](#high-severity-issues)
3. [Medium-Severity Issues](#medium-severity-issues)
4. [Security Best Practices](#security-best-practices)
5. [Audit Checklist](#audit-checklist)
6. [Implementation Timeline](#implementation-timeline)

---

## Critical Security Issues

### 1.1 Webhook Signature Verification (CRITICAL)

**Location:** `backend/api/webhooks/circle-gateway.ts` (lines 136-161)

**Current Implementation:**
```typescript
// STUB - NOT SECURE
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // In production, implement proper HMAC-SHA256 verification:
  console.log('Webhook signature verification:', signature.substring(0, 20) + '...');
  return true; // DANGER: Always returns true!
}
```

**Risk Assessment:**
| Factor | Rating |
|--------|--------|
| Exploitability | Easy |
| Impact | Critical |
| CVSS Score | 9.8 |

**Attack Scenario:**
1. Attacker crafts fake webhook payload
2. Sends POST request to `/api/webhooks/circle-gateway`
3. System processes fake deposit/withdrawal events
4. Attacker can trigger unauthorized fund movements

**Remediation:**

```typescript
// backend/api/webhooks/circle-gateway.ts
import crypto from 'crypto';

interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
  timestamp?: number;
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  maxAgeSeconds: number = 300 // 5 minutes
): WebhookVerificationResult {
  // 1. Validate inputs
  if (!payload || !signature || !secret) {
    return { isValid: false, error: 'Missing required parameters' };
  }

  // 2. Parse signature header (format: "t=timestamp,v1=signature")
  const signatureParts = signature.split(',');
  const timestampPart = signatureParts.find(p => p.startsWith('t='));
  const signaturePart = signatureParts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return { isValid: false, error: 'Invalid signature format' };
  }

  const timestamp = parseInt(timestampPart.substring(2), 10);
  const providedSignature = signaturePart.substring(3);

  // 3. Check timestamp freshness (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAgeSeconds) {
    return {
      isValid: false,
      error: `Webhook timestamp too old: ${now - timestamp}s`,
      timestamp
    };
  }

  // 4. Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // 5. Constant-time comparison (prevent timing attacks)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    return { isValid: false, error: 'Signature mismatch', timestamp };
  }

  return { isValid: true, timestamp };
}

// Usage in webhook handler
export async function POST(request: NextRequest) {
  const signature = request.headers.get('circle-signature');
  const rawBody = await request.text();

  const secret = process.env.CIRCLE_GATEWAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CIRCLE_GATEWAY_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const verification = verifyWebhookSignature(rawBody, signature || '', secret);

  if (!verification.isValid) {
    console.error('Webhook verification failed:', verification.error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // Continue processing...
  const payload = JSON.parse(rawBody);
  // ...
}
```

**Testing Requirements:**
```typescript
// backend/tests/webhooks/circle-gateway.test.ts
import { verifyWebhookSignature } from '../api/webhooks/circle-gateway';
import crypto from 'crypto';

describe('Webhook Signature Verification', () => {
  const secret = 'test-secret-key';
  const payload = '{"type":"deposit","amount":"1000"}';

  function generateValidSignature(payload: string, timestamp: number): string {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  it('should accept valid signatures', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateValidSignature(payload, timestamp);

    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result.isValid).toBe(true);
  });

  it('should reject expired signatures', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const signature = generateValidSignature(payload, timestamp);

    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('too old');
  });

  it('should reject invalid signatures', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = `t=${timestamp},v1=invalid_signature`;

    const result = verifyWebhookSignature(payload, signature, secret);
    expect(result.isValid).toBe(false);
  });

  it('should reject tampered payloads', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateValidSignature(payload, timestamp);
    const tamperedPayload = '{"type":"deposit","amount":"1000000"}';

    const result = verifyWebhookSignature(tamperedPayload, signature, secret);
    expect(result.isValid).toBe(false);
  });

  it('should reject missing parameters', () => {
    expect(verifyWebhookSignature('', 'sig', secret).isValid).toBe(false);
    expect(verifyWebhookSignature(payload, '', secret).isValid).toBe(false);
    expect(verifyWebhookSignature(payload, 'sig', '').isValid).toBe(false);
  });
});
```

---

### 1.2 Diamond Proxy Upgrade Vulnerability (CRITICAL)

**Location:** `contracts/src/invoice/InvoiceDiamond.sol` (lines 189-253)

**Current Implementation Issues:**

1. **No timelock for critical upgrades**
2. **Single admin can replace facets instantly**
3. **No pause mechanism during upgrades**
4. **No function selector collision detection**

**Risk Assessment:**
| Factor | Rating |
|--------|--------|
| Exploitability | Medium (requires admin key) |
| Impact | Critical (full fund access) |
| CVSS Score | 8.1 |

**Attack Scenario:**
1. Admin private key compromised
2. Attacker deploys malicious facet
3. Instantly replaces legitimate facet
4. Drains all funds before detection

**Remediation - Implement Timelock Pattern:**

```solidity
// contracts/src/invoice/libraries/LibTimelockStorage.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library LibTimelockStorage {
    bytes32 constant STORAGE_SLOT = keccak256("seedfinance.invoice.timelock.storage");

    struct PendingUpgrade {
        bytes32 proposalId;
        IDiamondCut.FacetCut[] cuts;
        address init;
        bytes initData;
        uint256 proposedAt;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }

    struct Storage {
        uint256 minDelay;           // Minimum delay before execution (e.g., 48 hours)
        uint256 maxDelay;           // Maximum delay before expiry (e.g., 7 days)
        mapping(bytes32 => PendingUpgrade) pendingUpgrades;
        bytes32[] pendingProposalIds;
        mapping(address => bool) proposers;
        mapping(address => bool) executors;
        mapping(address => bool) cancellers;
        bool upgradesPaused;
    }

    function getStorage() internal pure returns (Storage storage s) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            s.slot := slot
        }
    }
}
```

```solidity
// contracts/src/invoice/facets/TimelockFacet.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/LibTimelockStorage.sol";
import "../interfaces/IDiamondCut.sol";

contract TimelockFacet {
    using LibTimelockStorage for LibTimelockStorage.Storage;

    // Events
    event UpgradeProposed(
        bytes32 indexed proposalId,
        address indexed proposer,
        uint256 executeAfter,
        IDiamondCut.FacetCut[] cuts
    );
    event UpgradeExecuted(bytes32 indexed proposalId, address indexed executor);
    event UpgradeCancelled(bytes32 indexed proposalId, address indexed canceller);
    event UpgradesPaused(address indexed pauser);
    event UpgradesUnpaused(address indexed unpauser);

    // Errors
    error NotProposer();
    error NotExecutor();
    error NotCanceller();
    error UpgradeNotReady();
    error UpgradeExpired();
    error UpgradeAlreadyExecuted();
    error UpgradesCancelled();
    error UpgradesArePaused();
    error ProposalNotFound();
    error FunctionSelectorCollision(bytes4 selector, address existingFacet);

    modifier onlyProposer() {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        if (!s.proposers[msg.sender]) revert NotProposer();
        _;
    }

    modifier onlyExecutor() {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        if (!s.executors[msg.sender]) revert NotExecutor();
        _;
    }

    modifier onlyCanceller() {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        if (!s.cancellers[msg.sender]) revert NotCanceller();
        _;
    }

    modifier whenNotPaused() {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        if (s.upgradesPaused) revert UpgradesArePaused();
        _;
    }

    /**
     * @notice Propose a diamond cut upgrade with timelock
     * @param cuts The facet cuts to perform
     * @param init The initialization contract address
     * @param initData The initialization call data
     * @return proposalId The unique proposal identifier
     */
    function proposeUpgrade(
        IDiamondCut.FacetCut[] calldata cuts,
        address init,
        bytes calldata initData
    ) external onlyProposer whenNotPaused returns (bytes32 proposalId) {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();

        // Check for function selector collisions
        _validateNoCollisions(cuts);

        // Generate unique proposal ID
        proposalId = keccak256(abi.encode(
            cuts,
            init,
            initData,
            block.timestamp,
            msg.sender
        ));

        uint256 executeAfter = block.timestamp + s.minDelay;

        // Store pending upgrade
        LibTimelockStorage.PendingUpgrade storage upgrade = s.pendingUpgrades[proposalId];
        upgrade.proposalId = proposalId;
        upgrade.init = init;
        upgrade.initData = initData;
        upgrade.proposedAt = block.timestamp;
        upgrade.executeAfter = executeAfter;
        upgrade.executed = false;
        upgrade.cancelled = false;

        // Store cuts (requires loop due to storage array)
        for (uint256 i = 0; i < cuts.length; i++) {
            upgrade.cuts.push(cuts[i]);
        }

        s.pendingProposalIds.push(proposalId);

        emit UpgradeProposed(proposalId, msg.sender, executeAfter, cuts);
    }

    /**
     * @notice Execute a previously proposed upgrade after timelock
     * @param proposalId The proposal to execute
     */
    function executeUpgrade(bytes32 proposalId) external onlyExecutor whenNotPaused {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        LibTimelockStorage.PendingUpgrade storage upgrade = s.pendingUpgrades[proposalId];

        if (upgrade.proposalId == bytes32(0)) revert ProposalNotFound();
        if (upgrade.executed) revert UpgradeAlreadyExecuted();
        if (upgrade.cancelled) revert UpgradesCancelled();
        if (block.timestamp < upgrade.executeAfter) revert UpgradeNotReady();
        if (block.timestamp > upgrade.executeAfter + s.maxDelay) revert UpgradeExpired();

        upgrade.executed = true;

        // Execute the diamond cut
        _executeDiamondCut(upgrade.cuts, upgrade.init, upgrade.initData);

        emit UpgradeExecuted(proposalId, msg.sender);
    }

    /**
     * @notice Cancel a pending upgrade
     * @param proposalId The proposal to cancel
     */
    function cancelUpgrade(bytes32 proposalId) external onlyCanceller {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        LibTimelockStorage.PendingUpgrade storage upgrade = s.pendingUpgrades[proposalId];

        if (upgrade.proposalId == bytes32(0)) revert ProposalNotFound();
        if (upgrade.executed) revert UpgradeAlreadyExecuted();

        upgrade.cancelled = true;

        emit UpgradeCancelled(proposalId, msg.sender);
    }

    /**
     * @notice Emergency pause all upgrades
     */
    function pauseUpgrades() external onlyCanceller {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        s.upgradesPaused = true;
        emit UpgradesPaused(msg.sender);
    }

    /**
     * @notice Unpause upgrades
     */
    function unpauseUpgrades() external onlyProposer {
        LibTimelockStorage.Storage storage s = LibTimelockStorage.getStorage();
        s.upgradesPaused = false;
        emit UpgradesUnpaused(msg.sender);
    }

    // Internal functions
    function _validateNoCollisions(IDiamondCut.FacetCut[] calldata cuts) internal view {
        // Get current facet mappings from diamond storage
        // Check each new selector doesn't already exist with different facet
        // This prevents accidental or malicious function overwrites
    }

    function _executeDiamondCut(
        IDiamondCut.FacetCut[] storage cuts,
        address init,
        bytes storage initData
    ) internal {
        // Execute the actual diamond cut logic
        // (delegate to existing InvoiceDiamond._executeDiamondCut)
    }
}
```

**Additional Security Measures:**

```solidity
// Multi-sig requirement for upgrades
contract MultiSigTimelockFacet is TimelockFacet {
    uint256 public constant REQUIRED_SIGNATURES = 3;

    mapping(bytes32 => mapping(address => bool)) public approvals;
    mapping(bytes32 => uint256) public approvalCount;

    function approveUpgrade(bytes32 proposalId) external onlyExecutor {
        require(!approvals[proposalId][msg.sender], "Already approved");
        approvals[proposalId][msg.sender] = true;
        approvalCount[proposalId]++;
    }

    function executeUpgrade(bytes32 proposalId) external override onlyExecutor whenNotPaused {
        require(
            approvalCount[proposalId] >= REQUIRED_SIGNATURES,
            "Insufficient approvals"
        );
        super.executeUpgrade(proposalId);
    }
}
```

---

### 1.3 Cross-Chain Source Domain Validation (CRITICAL)

**Location:** `contracts/src/integrations/CCTPReceiver.sol` (lines 165-178)

**Current Implementation:**
```solidity
function processCCTPDeposit(
    uint32 sourceDomain,
    bytes32 sender,
    address beneficiary,
    uint256 amount,
    bytes32 nonce
) external {
    // No validation of sourceDomain!
    // Any source domain is accepted
}
```

**Risk:** Attacker could spoof deposits from unverified chains.

**Remediation:**

```solidity
// Add to CCTPReceiver.sol
mapping(uint32 => bool) public approvedSourceDomains;
mapping(uint32 => bytes32) public approvedSenders; // Expected sender per domain

error UnauthorizedSourceDomain(uint32 domain);
error UnauthorizedSender(uint32 domain, bytes32 sender);

function setApprovedDomain(
    uint32 domain,
    bool approved,
    bytes32 expectedSender
) external onlyOwner {
    approvedSourceDomains[domain] = approved;
    if (approved) {
        approvedSenders[domain] = expectedSender;
    }
    emit DomainApprovalUpdated(domain, approved, expectedSender);
}

function processCCTPDeposit(
    uint32 sourceDomain,
    bytes32 sender,
    address beneficiary,
    uint256 amount,
    bytes32 nonce
) external {
    // Validate source domain
    if (!approvedSourceDomains[sourceDomain]) {
        revert UnauthorizedSourceDomain(sourceDomain);
    }

    // Validate sender address for this domain
    if (approvedSenders[sourceDomain] != bytes32(0) &&
        approvedSenders[sourceDomain] != sender) {
        revert UnauthorizedSender(sourceDomain, sender);
    }

    // Continue processing...
}
```

---

## High-Severity Issues

### 2.1 Webhook Idempotency (HIGH)

**Location:** `backend/api/webhooks/circle-gateway.ts`

**Problem:** Duplicate webhook delivery can cause double-processing.

**Remediation:**

```typescript
// backend/services/IdempotencyService.ts
import { Redis } from 'ioredis';

interface ProcessedWebhook {
  processedAt: number;
  result: 'success' | 'failure';
  error?: string;
}

export class IdempotencyService {
  private redis: Redis;
  private ttlSeconds: number = 86400 * 7; // 7 days

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async isProcessed(webhookId: string): Promise<boolean> {
    const result = await this.redis.get(`webhook:${webhookId}`);
    return result !== null;
  }

  async markProcessed(
    webhookId: string,
    result: 'success' | 'failure',
    error?: string
  ): Promise<void> {
    const data: ProcessedWebhook = {
      processedAt: Date.now(),
      result,
      error,
    };
    await this.redis.setex(
      `webhook:${webhookId}`,
      this.ttlSeconds,
      JSON.stringify(data)
    );
  }

  async getProcessedInfo(webhookId: string): Promise<ProcessedWebhook | null> {
    const result = await this.redis.get(`webhook:${webhookId}`);
    return result ? JSON.parse(result) : null;
  }
}

// Usage in webhook handler
export async function POST(request: NextRequest) {
  const webhookId = request.headers.get('x-webhook-id') ||
                    crypto.randomUUID(); // Fallback to generated ID

  // Check if already processed
  if (await idempotencyService.isProcessed(webhookId)) {
    const info = await idempotencyService.getProcessedInfo(webhookId);
    console.log(`Webhook ${webhookId} already processed at ${info?.processedAt}`);
    return NextResponse.json({
      status: 'already_processed',
      originalResult: info?.result
    });
  }

  try {
    // Process webhook...
    await processWebhook(payload);

    await idempotencyService.markProcessed(webhookId, 'success');
    return NextResponse.json({ status: 'processed' });
  } catch (error) {
    await idempotencyService.markProcessed(webhookId, 'failure', error.message);
    throw error;
  }
}
```

---

### 2.2 Treasury Manager Reentrancy (HIGH)

**Location:** `contracts/src/base/TreasuryManager.sol` (lines 323-348)

**Problem:** `rebalance()` makes multiple external calls without reentrancy protection.

**Current Code:**
```solidity
function rebalance() external onlyOwner {
    // Multiple external calls without reentrancy guard
    for (uint256 i = 0; i < strategies.length; i++) {
        ITreasuryStrategy(strategies[i]).withdrawAll(); // External call
    }
    _distributeDeposit(totalBalance); // More external calls
}
```

**Remediation:**

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TreasuryManager is AccessControl, ReentrancyGuard {
    // Add nonReentrant modifier
    function rebalance() external onlyOwner nonReentrant {
        // Existing logic...
    }

    function withdraw(uint256 amount) external onlyLiquidityPool nonReentrant {
        // Existing logic...
    }

    function deposit(uint256 amount) external onlyLiquidityPool nonReentrant {
        // Existing logic...
    }
}
```

---

### 2.3 Integer Precision Loss in Discount Calculation (HIGH)

**Location:** `contracts/src/invoice/libraries/LibInvoiceStorage.sol` (lines 102-111)

**Problem:**
```solidity
function calculateFundingAmount(
    uint128 faceValue,
    uint16 discountRateBps,
    uint64 maturityDate
) internal view returns (uint128) {
    uint256 secondsToMaturity = maturityDate > uint64(block.timestamp)
        ? maturityDate - uint64(block.timestamp)
        : 0;

    // PROBLEM: Division before multiplication causes precision loss
    uint256 annualDiscount = (uint256(faceValue) * discountRateBps) / 10000;
    uint256 discount = (annualDiscount * secondsToMaturity) / 365 days;

    return uint128(uint256(faceValue) - discount);
}
```

**Example of precision loss:**
- Face value: 1,000 USDC (1,000,000,000 in 6 decimals)
- Discount rate: 1 bps (0.01%)
- Maturity: 1 day

```
annualDiscount = (1,000,000,000 * 1) / 10000 = 100,000
discount = (100,000 * 86,400) / 31,536,000 = 0.27... → rounds to 0
```

**Remediation - Use Fixed-Point Math:**

```solidity
// contracts/src/invoice/libraries/LibFixedPoint.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library LibFixedPoint {
    uint256 constant SCALE = 1e18;
    uint256 constant HALF_SCALE = 5e17;

    /// @notice Multiply two fixed-point numbers
    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 denominator
    ) internal pure returns (uint256 result) {
        // Use assembly for optimal precision
        assembly {
            // 512-bit multiply
            let mm := mulmod(x, y, not(0))
            let prod0 := mul(x, y)
            let prod1 := sub(sub(mm, prod0), lt(mm, prod0))

            // Handle non-overflow cases
            if iszero(prod1) {
                result := div(prod0, denominator)
            }
            // Handle overflow - more complex logic needed
        }
    }

    /// @notice Calculate discount with full precision
    function calculateDiscount(
        uint256 faceValue,
        uint256 discountRateBps,
        uint256 secondsToMaturity
    ) internal pure returns (uint256) {
        // Multiply first, then divide - preserves precision
        // discount = faceValue * discountRateBps * secondsToMaturity / (10000 * 365 days)
        uint256 numerator = faceValue * discountRateBps * secondsToMaturity;
        uint256 denominator = 10000 * 365 days;

        // Round down for discount (favors protocol)
        return numerator / denominator;
    }
}

// Updated LibInvoiceStorage.sol
function calculateFundingAmount(
    uint128 faceValue,
    uint16 discountRateBps,
    uint64 maturityDate
) internal view returns (uint128) {
    uint256 secondsToMaturity = maturityDate > uint64(block.timestamp)
        ? maturityDate - uint64(block.timestamp)
        : 0;

    // Use fixed-point calculation
    uint256 discount = LibFixedPoint.calculateDiscount(
        uint256(faceValue),
        uint256(discountRateBps),
        secondsToMaturity
    );

    // Ensure discount doesn't exceed face value
    if (discount >= faceValue) {
        return 0;
    }

    return uint128(uint256(faceValue) - discount);
}
```

**Test for Precision:**

```solidity
// contracts/test/DiscountPrecision.t.sol
function testFuzz_DiscountPrecision(
    uint128 faceValue,
    uint16 discountRateBps,
    uint32 secondsToMaturity
) public {
    vm.assume(faceValue > 0 && faceValue <= 1e15); // Up to 1B USDC
    vm.assume(discountRateBps <= 5000); // Max 50% annual
    vm.assume(secondsToMaturity > 0 && secondsToMaturity <= 365 days);

    uint256 discount = LibFixedPoint.calculateDiscount(
        faceValue,
        discountRateBps,
        secondsToMaturity
    );

    // Verify discount is always less than face value
    assertLt(discount, faceValue);

    // Verify precision - discount should be at least 1 if rate > 0 and time > 0
    if (faceValue >= 1e6 && discountRateBps >= 100 && secondsToMaturity >= 1 days) {
        assertGt(discount, 0, "Discount should not round to zero");
    }
}
```

---

## Medium-Severity Issues

### 3.1 Missing Slippage Protection in LP Withdrawals

**Location:** `contracts/src/base/LiquidityPool.sol` (lines 142-164)

**Problem:** Users are vulnerable to sandwich attacks during withdrawals.

**Remediation:**

```solidity
// Add to LiquidityPool.sol
function withdrawWithSlippage(
    uint256 assets,
    address receiver,
    address owner,
    uint256 minShares
) public virtual returns (uint256 shares) {
    shares = previewWithdraw(assets);

    // Slippage protection
    if (shares > minShares) {
        revert SlippageExceeded(shares, minShares);
    }

    _withdraw(_msgSender(), receiver, owner, assets, shares);
}

function redeemWithSlippage(
    uint256 shares,
    address receiver,
    address owner,
    uint256 minAssets
) public virtual returns (uint256 assets) {
    assets = previewRedeem(shares);

    // Slippage protection
    if (assets < minAssets) {
        revert SlippageExceeded(assets, minAssets);
    }

    _withdraw(_msgSender(), receiver, owner, assets, shares);
}
```

---

### 3.2 Missing Circuit Breaker for Treasury Strategies

**Location:** `contracts/src/base/TreasuryManager.sol`

**Problem:** No automatic protection if strategy yields drop unexpectedly.

**Remediation:**

```solidity
// Add circuit breaker functionality
uint256 public yieldThresholdBps = 100; // 1% minimum expected yield
uint256 public maxDrawdownBps = 500; // 5% max drawdown before pause

struct StrategyHealth {
    uint256 lastValue;
    uint256 lastCheck;
    bool isPaused;
}

mapping(address => StrategyHealth) public strategyHealth;

function checkStrategyHealth(address strategy) external {
    uint256 currentValue = ITreasuryStrategy(strategy).totalValue();
    StrategyHealth storage health = strategyHealth[strategy];

    if (health.lastValue > 0) {
        uint256 drawdown = health.lastValue > currentValue
            ? ((health.lastValue - currentValue) * 10000) / health.lastValue
            : 0;

        if (drawdown > maxDrawdownBps) {
            health.isPaused = true;
            emit StrategyCircuitBreaker(strategy, drawdown);

            // Auto-withdraw from unhealthy strategy
            _emergencyWithdraw(strategy);
        }
    }

    health.lastValue = currentValue;
    health.lastCheck = block.timestamp;
}
```

---

## Security Best Practices

### 4.1 Input Validation Checklist

| Parameter Type | Validation Required |
|---------------|---------------------|
| Addresses | Non-zero, not contract (if EOA expected) |
| Amounts | Non-zero, within bounds, no overflow |
| Timestamps | Future (if maturity), within reasonable range |
| Rates (bps) | 0-10000 range |
| Array lengths | Maximum bounds, non-empty if required |
| Strings/bytes | Maximum length, valid encoding |

### 4.2 Access Control Matrix

| Function | Owner | Operator | Proposer | Executor | User |
|----------|-------|----------|----------|----------|------|
| Diamond upgrade | - | - | Propose | Execute | - |
| Add strategy | Yes | - | - | - | - |
| Pause | Yes | Yes | - | - | - |
| Create invoice | - | - | - | - | Supplier |
| Approve invoice | - | - | - | - | Buyer |
| Fund invoice | - | Yes | - | - | - |
| Repay invoice | - | - | - | - | Buyer |

### 4.3 Event Emission Requirements

Every state change MUST emit an event:

```solidity
// Good
function transfer(address to, uint256 amount) external {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    emit Transfer(msg.sender, to, amount); // Required
}

// Bad - missing event
function transfer(address to, uint256 amount) external {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    // No event - can't track off-chain
}
```

---

## Audit Checklist

### Pre-Audit Tasks

- [ ] Run Slither static analysis
- [ ] Run Mythril symbolic execution
- [ ] Complete unit test coverage (>90%)
- [ ] Complete integration tests
- [ ] Fuzz testing for all math operations
- [ ] Document all external calls
- [ ] Document all access control
- [ ] Document upgrade procedures
- [ ] Create threat model

### Audit Scope

| Category | Files | Priority |
|----------|-------|----------|
| Core Logic | InvoiceDiamond.sol, all facets | Critical |
| Token Handling | LiquidityPool.sol, ExecutionPool.sol | Critical |
| External Integrations | CCTPReceiver.sol | High |
| Treasury | TreasuryManager.sol, strategies | High |
| Admin Functions | All onlyOwner/onlyAdmin | Medium |

### Post-Audit Tasks

- [ ] Address all critical findings
- [ ] Address all high findings
- [ ] Document accepted risks for medium/low
- [ ] Re-audit after fixes
- [ ] Bug bounty program launch

---

## Implementation Timeline

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Webhook security (1.1, 2.1) | 3 days | None |
| **Phase 2** | Diamond timelock (1.2) | 5 days | None |
| **Phase 3** | CCTP validation (1.3) | 2 days | None |
| **Phase 4** | Reentrancy guards (2.2) | 1 day | None |
| **Phase 5** | Precision fixes (2.3) | 2 days | None |
| **Phase 6** | Slippage protection (3.1) | 1 day | None |
| **Phase 7** | Circuit breaker (3.2) | 3 days | None |
| **Phase 8** | Testing & verification | 5 days | All above |
| **Total** | | **22 days** | |

---

## References

- [OpenZeppelin Security Best Practices](https://docs.openzeppelin.com/contracts/4.x/)
- [ConsenSys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [SWC Registry](https://swcregistry.io/)
- [EIP-2535: Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [HMAC-SHA256 Specification](https://datatracker.ietf.org/doc/html/rfc2104)
