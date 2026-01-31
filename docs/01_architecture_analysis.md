# Architecture Analysis: Base-Only vs. Arc + Base

> **Decision:** Seed Finance uses a single-chain deployment on Base L2.

---

## Executive Summary

After thorough analysis, we chose **Base-only deployment** over the original Arc + Base dual-chain architecture. This decision optimizes for:

- **Speed to market** (2-3x faster development)
- **Reduced risk** (no bridge dependencies)
- **Lower audit scope** (single chain)
- **Equivalent functionality** (all Circle tools work on Base)

---

## Background

### Original Design (Hackathon)

The original architecture used two chains:

```
Arc (Circle L1)          Base L2
├── LiquidityPool.sol    ├── InvoiceRegistry.sol
├── BridgeRouter.sol     ├── ExecutionPool.sol
└── CCTP V2 Bridge  ←→   └── PaymentRouter.sol
```

**Rationale:** This design targeted Circle hackathon prizes requiring Arc integration.

### Production Design (Current)

The production architecture consolidates everything on Base:

```
Base L2 (Single Chain)
├── LiquidityPool.sol      ← ERC-4626 vault for LP deposits
├── InvoiceRegistry.sol    ← Invoice lifecycle
├── ExecutionPool.sol      ← USDC holding for funding
├── PaymentRouter.sol      ← Orchestration
├── TreasuryManager.sol    ← USYC yield (optional Phase 2)
│
└── Circle Integration
    ├── Circle Wallets     ← Works natively on Base
    └── Circle Gateway     ← Works natively on Base
```

---

## Comparison

### Development Time

| Task | Arc + Base | Base Only |
|------|------------|-----------|
| Contract Development | 6-8 weeks | 2-3 weeks |
| Audit Scope | 2 chains | 1 chain |
| Backend Complexity | Cross-chain events | Single-chain events |
| Testing | Bridge integration | Standard EVM |

**Winner:** Base-only is 2-3x faster to ship.

### Technical Risk

| Risk Factor | Arc + Base | Base Only |
|-------------|------------|-----------|
| Bridge Risk | CCTP V2 dependency | None |
| Chain Maturity | Arc is early-stage | Base is battle-tested |
| Ecosystem | Limited on Arc | Deep DeFi ecosystem |
| Support | Limited | Coinbase backing |

**Winner:** Base-only has significantly lower risk.

### Circle Tool Availability

| Tool | Works on Arc? | Works on Base? |
|------|---------------|----------------|
| Circle Wallets | Yes | Yes |
| Circle Gateway | Yes | Yes |
| USDC | Yes (18 decimals) | Yes (6 decimals) |
| CCTP | Yes | Yes |

**Key Insight:** All valuable Circle tools work on Base directly. Arc is not required.

### Costs

| Metric | Arc | Base |
|--------|-----|------|
| Gas Token | USDC | ETH |
| Typical TX Cost | ~$0.001 | ~$0.001 |
| Block Time | <1 second | ~2 seconds |
| Finality | Instant | ~2 seconds |

**Winner:** Roughly equivalent, with Arc having slightly faster finality.

---

## When Arc Makes Sense

Arc's value proposition is **chain abstraction** — aggregating USDC liquidity from multiple chains into a single pool. This makes sense when:

1. **Multi-chain LPs** — You need to aggregate liquidity from 5+ chains
2. **USDC-only gas** — Your users refuse to hold any token except USDC
3. **Maximum Circle integration** — You want every Circle product in one place
4. **Institutional focus** — Targeting enterprise capital markets

### When Arc Doesn't Make Sense

Arc adds complexity without proportional benefit when:

1. **Speed matters** — You need to ship fast (MVP, proof of concept)
2. **Single-chain LPs** — Your LPs are primarily on 1-2 chains
3. **Standard gas is OK** — You can accept ETH gas costs (~$0.001)
4. **Minimize risk** — You want to avoid bridge dependencies

---

## Our Situation

| Factor | Our Case | Implication |
|--------|----------|-------------|
| **LP Source** | Primarily Base/Coinbase ecosystem | Single-chain sufficient |
| **Users** | Both traditional + crypto-native | Circle Gateway handles fiat |
| **Priority** | Speed to market | Simpler = faster |
| **Risk Tolerance** | Low | No bridge risk |

**Conclusion:** Base-only is the right choice for our production deployment.

---

## What We Keep

Moving to Base-only, we retain all critical capabilities:

| Capability | How We Get It |
|------------|---------------|
| Fiat on/off-ramp | Circle Gateway (works on Base) |
| Wallet abstraction | Circle Wallets (works on Base) |
| USDC operations | Native USDC on Base |
| LP deposits | Direct to Base LiquidityPool |
| Low gas costs | ~$0.001 per transaction |
| Fast finality | ~2 seconds |
| Account abstraction | 87% of ERC-4337 activity on Base |

---

## What We Drop

| Dropped Component | Why It's OK |
|-------------------|-------------|
| Arc deployment | Not needed for core value proposition |
| CCTP V2 bridging | LPs deposit directly on Base |
| Two-chain architecture | Reduces complexity and risk |
| 18-decimal USDC handling | Standard 6 decimals is simpler |

---

## Future Considerations

### Phase 2: Multi-Chain LP Expansion

If LP demand exceeds Base-native liquidity, we can add CCTP integration:

```
Ethereum LP ──CCTP──► Base LiquidityPool
Arbitrum LP ──CCTP──► Base LiquidityPool
```

This is simpler than the Arc aggregation layer because:
- LPs bridge directly to Base (no intermediate chain)
- Single destination for all liquidity
- Standard CCTP flow (well-documented)

### When to Reconsider Arc

We would revisit Arc integration if:
- Multi-chain LP demand becomes significant (>30% of TVL)
- Arc matures significantly (deeper ecosystem, more integrations)
- Circle offers compelling incentives for Arc usage

---

## Implementation Impact

### Contract Changes

| Original (Arc + Base) | New (Base Only) |
|-----------------------|-----------------|
| Arc: LiquidityPool.sol | Base: LiquidityPool.sol |
| Arc: BridgeRouter.sol | Removed |
| Base: InvoiceRegistry.sol | Base: InvoiceRegistry.sol |
| Base: ExecutionPool.sol | Base: ExecutionPool.sol (simplified) |
| Base: PaymentRouter.sol | Base: PaymentRouter.sol |

### Backend Changes

| Original | New |
|----------|-----|
| Listen to Arc + Base events | Listen to Base events only |
| Manage cross-chain state | Single-chain state |
| CCTP attestation handling | Removed |

### Documentation Updates

| Document | Change |
|----------|--------|
| CLAUDE.md | Rewritten for Base-only |
| README.md | Updated architecture diagram |
| ARC-REFERENCE.md | Archived |
| BASE-REFERENCE.md | Primary reference |
| This document | Created |

---

## Conclusion

**Base-only deployment is the right choice for Seed Finance production.**

| Criterion | Score |
|-----------|-------|
| Speed to Market | Better |
| Technical Risk | Better |
| Circle Integration | Equal |
| Cost | Equal |
| Complexity | Better |

Arc is a good technology solving a real problem (chain abstraction), but it's not our core value proposition. Our product is **invoice financing**, not **liquidity aggregation**.

By going Base-only:
- We ship 2-3x faster
- We reduce audit scope by 50%
- We eliminate bridge risk
- We keep all the Circle benefits that matter

Arc can be added later if multi-chain LP demand materializes. Start simple, validate the product, then expand.

---

## References

- [CLAUDE.md](../CLAUDE.md) — Technical implementation guide
- [BASE-REFERENCE.md](./BASE-REFERENCE.md) — Base network details
- [Arc Reference (Archived)](./archive/ARC-REFERENCE.md) — Historical reference

---

*Document Version: 1.0*
*Created: 2026-01-31*
*Status: Approved for implementation*
