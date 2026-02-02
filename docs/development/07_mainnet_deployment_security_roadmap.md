# Mainnet Deployment Security Roadmap

> **Status:** Planning
> **Target:** Base Mainnet
> **Last Updated:** 2026-02-02

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pre-Deployment Security Checklist](#2-pre-deployment-security-checklist)
3. [Testing Requirements](#3-testing-requirements)
4. [Audit Process](#4-audit-process)
5. [Deployment Procedure](#5-deployment-procedure)
6. [Access Control & Key Management](#6-access-control--key-management)
7. [Post-Deployment Monitoring](#7-post-deployment-monitoring)
8. [Emergency Procedures](#8-emergency-procedures)
9. [Contract-Specific Security Concerns](#9-contract-specific-security-concerns)
10. [Timeline & Milestones](#10-timeline--milestones)

---

## 1. Executive Summary

This document outlines the security roadmap for deploying Seed Finance contracts to Base Mainnet. The deployment involves significant financial risk as these contracts will handle real USDC deposits from LPs.

### Contracts to Deploy

| Contract | Risk Level | TVL Impact |
|----------|------------|------------|
| LiquidityPool.sol | **CRITICAL** | Direct custody of LP funds |
| TreasuryManager.sol | **HIGH** | Manages strategy allocations |
| USYCStrategy.sol | **HIGH** | External protocol integration |
| InvoiceRegistry.sol | **MEDIUM** | Invoice state management |
| ExecutionPool.sol | **HIGH** | Invoice funding custody |
| PaymentRouter.sol | **HIGH** | Payment orchestration |

### Key Risks

1. **Smart contract vulnerabilities** — Reentrancy, overflow, access control bypass
2. **Economic attacks** — Flash loans, price manipulation, sandwich attacks
3. **Integration risks** — USYC protocol changes, USDC blacklisting
4. **Operational risks** — Key compromise, misconfiguration, upgrade errors
5. **Regulatory risks** — USDC freezing, compliance requirements

---

## 2. Pre-Deployment Security Checklist

### 2.1 Code Quality

- [ ] All contracts compile without warnings
- [ ] No compiler version pragma issues (locked to 0.8.26)
- [ ] NatSpec documentation complete for all public/external functions
- [ ] No TODO/FIXME comments remaining in production code
- [ ] Code formatting consistent (run `forge fmt`)
- [ ] No unused imports, variables, or functions
- [ ] Custom errors used instead of revert strings (gas optimization)

### 2.2 Security Patterns Verification

- [ ] **Reentrancy Protection**
  - All external calls to untrusted contracts use `nonReentrant`
  - State changes happen before external calls (CEI pattern)
  - LiquidityPool: `deployForFunding()`, `receiveRepayment()`
  - TreasuryManager: `deposit()`, `withdraw()`, `rebalance()`
  - USYCStrategy: `_deposit()`, `_withdraw()`

- [ ] **Access Control**
  - All privileged functions have proper modifiers
  - Role hierarchy is correct (DEFAULT_ADMIN_ROLE → other roles)
  - No functions missing access control that should have it
  - `onlyOwner` vs `onlyRole` used appropriately

- [ ] **Integer Safety**
  - Solidity 0.8.26 has built-in overflow checks
  - Division operations checked for division by zero
  - Percentage calculations (basis points) bounded correctly
  - Share calculations in ERC-4626 handle edge cases

- [ ] **External Call Safety**
  - `SafeERC20` used for all token transfers
  - Return values checked for external calls
  - No assumptions about external contract behavior
  - USYC integration handles potential failures

### 2.3 Known Vulnerability Scan

Run automated tools before manual review:

```bash
# Install and run Slither (static analyzer)
pip install slither-analyzer
slither contracts/src/ --config-file slither.config.json

# Run Mythril (symbolic execution)
docker run -v $(pwd):/code mythril/myth analyze /code/contracts/src/base/LiquidityPool.sol

# Run Aderyn (Rust-based analyzer)
cargo install aderyn
aderyn contracts/src/
```

### 2.4 Gas Optimization Review

- [ ] No unbounded loops in any function
- [ ] Storage reads minimized (cache in memory)
- [ ] Events emit only necessary data
- [ ] Batch operations available where beneficial
- [ ] View functions don't perform unnecessary computation

---

## 3. Testing Requirements

### 3.1 Unit Test Coverage

**Target: >95% line coverage, 100% branch coverage for critical paths**

```bash
# Run tests with coverage
forge coverage --report lcov

# Generate HTML report
genhtml lcov.info -o coverage-report
```

Required test scenarios:

#### LiquidityPool.sol
- [ ] Deposit: single user, multiple users, max deposit, zero deposit
- [ ] Withdraw: partial, full, more than balance, during pause
- [ ] Share calculation: first depositor, subsequent depositors, after yield
- [ ] Treasury integration: deploy to treasury, withdraw from treasury
- [ ] Invoice funding: deploy for invoice, receive repayment
- [ ] Access control: unauthorized calls to privileged functions
- [ ] Pause: all operations blocked during pause
- [ ] Emergency: withdrawal works correctly

#### TreasuryManager.sol
- [ ] Strategy management: add, remove, weight changes
- [ ] Deposit: single strategy, multiple strategies, weight-based allocation
- [ ] Withdraw: single strategy, prioritize instant, handle slippage
- [ ] Rebalance: respects cooldown, correct reallocation
- [ ] Edge cases: all strategies paused, strategy returns less than expected

#### USYCStrategy.sol
- [ ] Deposit: USDC → USYC conversion
- [ ] Withdraw: USYC → USDC conversion with yield
- [ ] Value calculation: includes accrued yield
- [ ] Integration: works with real USYC interface (fork test)

### 3.2 Integration Tests

```bash
# Fork mainnet for integration tests
forge test --fork-url $BASE_MAINNET_RPC_URL -vvv
```

Required integration tests:

- [ ] Full LP lifecycle: deposit → treasury allocation → invoice funding → repayment → withdrawal
- [ ] USYC integration with real contract on Base
- [ ] Multi-user scenarios with realistic amounts
- [ ] Gas usage under various conditions

### 3.3 Fuzz Testing

```bash
# Run fuzz tests with high iterations
forge test --fuzz-runs 10000
```

Fuzz test targets:

- [ ] Share calculation invariants (shares * price = assets)
- [ ] Total assets always >= sum of user shares value
- [ ] Strategy weights always sum to <= 10000 bps
- [ ] No way to extract more than deposited + earned yield

### 3.4 Invariant Testing

```solidity
// Example invariant test
function invariant_totalAssetsNeverNegative() public {
    assertGe(liquidityPool.totalAssets(), 0);
}

function invariant_sharesValueMatchesAssets() public {
    uint256 totalShares = liquidityPool.totalSupply();
    if (totalShares > 0) {
        uint256 totalValue = liquidityPool.totalAssets();
        // Each share should be worth totalValue / totalShares
        assertApproxEqRel(
            liquidityPool.convertToAssets(totalShares),
            totalValue,
            0.001e18 // 0.1% tolerance
        );
    }
}
```

### 3.5 Formal Verification (Optional but Recommended)

Consider using Certora or Halmos for critical invariants:

- Share price monotonically non-decreasing (except for slashing scenarios)
- Total deployed + available + treasury = total assets
- Only authorized roles can move funds

---

## 4. Audit Process

### 4.1 Audit Preparation

Before engaging auditors:

1. **Documentation Package**
   - [ ] Architecture overview diagram
   - [ ] Contract interaction flows
   - [ ] Access control matrix
   - [ ] Known limitations and assumptions
   - [ ] External dependencies list
   - [ ] Test coverage report

2. **Scope Definition**
   - Lines of code: ~1,900 (current contracts)
   - External integrations: USYC, USDC
   - Complexity: Medium-High (DeFi protocol)

### 4.2 Recommended Auditors

| Auditor | Specialization | Est. Cost | Timeline |
|---------|---------------|-----------|----------|
| Trail of Bits | Complex DeFi, formal verification | $150k-300k | 6-8 weeks |
| OpenZeppelin | ERC standards, access control | $100k-200k | 4-6 weeks |
| Spearbit | DeFi protocols, economic attacks | $80k-150k | 4-6 weeks |
| Code4rena | Competitive audit, broad coverage | $50k-100k | 2-3 weeks |
| Sherlock | Bug bounty + audit hybrid | $40k-80k | 2-4 weeks |

**Recommendation:**
- **Primary audit:** OpenZeppelin or Spearbit (established reputation)
- **Secondary audit:** Code4rena competitive audit (fresh eyes)

### 4.3 Audit Scope Priorities

**Critical (Must Audit):**
1. LiquidityPool.sol — Holds all LP funds
2. TreasuryManager.sol — Controls fund allocation
3. USYCStrategy.sol — External protocol integration

**High (Should Audit):**
4. ExecutionPool.sol — Invoice funding custody
5. PaymentRouter.sol — Payment orchestration

**Medium (Can Self-Review):**
6. InvoiceRegistry.sol — State management only
7. BaseTreasuryStrategy.sol — Abstract base

### 4.4 Post-Audit Process

1. **Triage findings** — Classify by severity (Critical/High/Medium/Low/Info)
2. **Fix critical/high** — Must be resolved before deployment
3. **Document medium/low** — Accept risk or fix based on cost-benefit
4. **Re-review fixes** — Auditor verifies remediation
5. **Final report** — Public audit report for transparency

---

## 5. Deployment Procedure

### 5.1 Deployment Environment Setup

```bash
# Create deployment wallet (hardware wallet recommended)
# NEVER use EOA with private key in .env for mainnet

# Use a fresh deployer address
# Fund with ETH for gas (0.1 ETH should be sufficient)

# Verify RPC endpoint reliability
cast chain-id --rpc-url $BASE_MAINNET_RPC_URL
# Should return: 8453
```

### 5.2 Deployment Order

**Phase 1: Core Infrastructure**
```
1. Deploy LiquidityPool
   └── Constructor: USDC address, name, symbol

2. Deploy TreasuryManager
   └── Constructor: USDC address, LiquidityPool address

3. Deploy USYCStrategy
   └── Constructor: USDC, USYC, TreasuryManager, initial APY
```

**Phase 2: Configure Roles**
```
4. LiquidityPool.grantRole(TREASURY_ROLE, TreasuryManager)
5. TreasuryManager.addStrategy(USYCStrategy, weight)
6. Transfer ownership to multisig
```

**Phase 3: Invoice System (when ready)**
```
7. Deploy InvoiceRegistry
8. Deploy ExecutionPool
9. Deploy PaymentRouter
10. Configure cross-contract permissions
```

### 5.3 Deployment Script

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/base/LiquidityPool.sol";
import "../src/base/TreasuryManager.sol";
import "../src/strategies/USYCStrategy.sol";

contract DeployMainnet is Script {
    // Base Mainnet addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USYC = 0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b;

    // Multisig address (Gnosis Safe)
    address constant MULTISIG = address(0); // TODO: Set before deployment

    function run() external {
        require(MULTISIG != address(0), "Set multisig address");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy LiquidityPool
        LiquidityPool pool = new LiquidityPool(
            IERC20(USDC),
            "Seed",
            "SEED"
        );
        console.log("LiquidityPool deployed:", address(pool));

        // 2. Deploy TreasuryManager
        TreasuryManager treasury = new TreasuryManager(
            USDC,
            address(pool)
        );
        console.log("TreasuryManager deployed:", address(treasury));

        // 3. Deploy USYCStrategy
        USYCStrategy strategy = new USYCStrategy(
            USDC,
            USYC,
            address(treasury),
            450 // 4.5% estimated APY
        );
        console.log("USYCStrategy deployed:", address(strategy));

        // 4. Configure roles
        pool.grantRole(pool.TREASURY_ROLE(), address(treasury));
        treasury.addStrategy(address(strategy), 10000); // 100% to USYC

        // 5. Transfer admin to multisig
        pool.grantRole(pool.DEFAULT_ADMIN_ROLE(), MULTISIG);
        pool.renounceRole(pool.DEFAULT_ADMIN_ROLE(), msg.sender);

        treasury.grantRole(treasury.DEFAULT_ADMIN_ROLE(), MULTISIG);
        treasury.renounceRole(treasury.DEFAULT_ADMIN_ROLE(), msg.sender);

        strategy.transferOwnership(MULTISIG);

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("LiquidityPool:", address(pool));
        console.log("TreasuryManager:", address(treasury));
        console.log("USYCStrategy:", address(strategy));
        console.log("Admin Multisig:", MULTISIG);
    }
}
```

### 5.4 Deployment Verification

```bash
# Verify contracts on Basescan
forge verify-contract \
    --chain-id 8453 \
    --compiler-version v0.8.26 \
    --constructor-args $(cast abi-encode "constructor(address,string,string)" $USDC "Seed" "SEED") \
    $LIQUIDITY_POOL_ADDRESS \
    src/base/LiquidityPool.sol:LiquidityPool

# Verify each contract similarly
```

### 5.5 Post-Deployment Validation

```bash
# Verify contract state
cast call $LIQUIDITY_POOL --rpc-url $BASE_MAINNET_RPC_URL "asset()(address)"
# Should return USDC address

cast call $LIQUIDITY_POOL --rpc-url $BASE_MAINNET_RPC_URL "hasRole(bytes32,address)(bool)" $(cast keccak "TREASURY_ROLE") $TREASURY_MANAGER
# Should return true

# Verify ownership transferred
cast call $LIQUIDITY_POOL --rpc-url $BASE_MAINNET_RPC_URL "hasRole(bytes32,address)(bool)" 0x0000000000000000000000000000000000000000000000000000000000000000 $MULTISIG
# Should return true (DEFAULT_ADMIN_ROLE)
```

---

## 6. Access Control & Key Management

### 6.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL MATRIX                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GNOSIS SAFE MULTISIG (3-of-5)                                  │
│  └── DEFAULT_ADMIN_ROLE                                         │
│      ├── Can grant/revoke all roles                             │
│      ├── Can upgrade contracts (if upgradeable)                 │
│      └── Emergency functions                                     │
│                                                                  │
│  LIQUIDITY POOL ROLES                                           │
│  ├── TREASURY_ROLE → TreasuryManager contract only              │
│  │   └── depositToTreasury, withdrawFromTreasury                │
│  ├── ROUTER_ROLE → PaymentRouter contract only                  │
│  │   └── deployForFunding, receiveRepayment                     │
│  └── PAUSER_ROLE → Multisig + designated operator               │
│      └── pause, unpause                                          │
│                                                                  │
│  TREASURY MANAGER ROLES                                         │
│  ├── POOL_ROLE → LiquidityPool contract only                    │
│  │   └── deposit, withdraw                                       │
│  ├── STRATEGIST_ROLE → Multisig + designated strategist         │
│  │   └── addStrategy, removeStrategy, rebalance                 │
│  └── PAUSER_ROLE → Multisig + designated operator               │
│      └── pause, unpause, pauseStrategy                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Multisig Configuration

**Recommended Setup: Gnosis Safe (3-of-5)**

| Signer | Role | Key Storage |
|--------|------|-------------|
| Signer 1 | Founder/CEO | Hardware wallet (Ledger) |
| Signer 2 | CTO/Tech Lead | Hardware wallet (Ledger) |
| Signer 3 | Security Lead | Hardware wallet (Trezor) |
| Signer 4 | Advisor | Hardware wallet |
| Signer 5 | Legal/Compliance | Hardware wallet |

**Multisig Policies:**
- Minimum 3 signatures for any transaction
- 24-hour timelock for non-emergency transactions
- Emergency bypass requires 4-of-5 signatures
- Regular key rotation (annually)
- Backup recovery procedures documented

### 6.3 Key Security Best Practices

1. **Never store private keys in:**
   - Environment variables on production servers
   - Git repositories (even private ones)
   - Cloud storage without encryption
   - Plain text files

2. **Deployment key handling:**
   - Use hardware wallet for deployment
   - Generate fresh deployer address
   - Transfer ownership immediately after deployment
   - Zero out deployer balance after deployment

3. **Operational security:**
   - Use dedicated machines for signing
   - Air-gapped signing for large transactions
   - Regular security training for signers
   - Incident response plan documented

---

## 7. Post-Deployment Monitoring

### 7.1 On-Chain Monitoring

Set up alerts for:

| Event | Severity | Response |
|-------|----------|----------|
| Large deposit (>$100k) | Info | Log and verify source |
| Large withdrawal (>$100k) | Warning | Verify authorized |
| Admin role change | Critical | Immediate investigation |
| Contract paused | Critical | Confirm intentional |
| Strategy removed | High | Verify authorized |
| Unusual gas usage | Warning | Check for attack |

**Tools:**
- [Tenderly](https://tenderly.co/) — Transaction monitoring, alerts
- [OpenZeppelin Defender](https://defender.openzeppelin.com/) — Automated monitoring
- [Forta](https://forta.org/) — Threat detection bots

### 7.2 Off-Chain Monitoring

```typescript
// monitoring/alerts.ts
import { ethers } from 'ethers';

const THRESHOLDS = {
  LARGE_DEPOSIT: ethers.parseUnits('100000', 6), // 100k USDC
  LARGE_WITHDRAWAL: ethers.parseUnits('100000', 6),
  TVL_DROP_PERCENT: 20, // Alert if TVL drops 20%
};

// Monitor contract events
pool.on('Deposit', async (sender, owner, assets, shares) => {
  if (assets > THRESHOLDS.LARGE_DEPOSIT) {
    await sendAlert('LARGE_DEPOSIT', { sender, assets: assets.toString() });
  }
});

pool.on('Withdraw', async (sender, receiver, owner, assets, shares) => {
  if (assets > THRESHOLDS.LARGE_WITHDRAWAL) {
    await sendAlert('LARGE_WITHDRAWAL', { sender, receiver, assets: assets.toString() });
  }
});
```

### 7.3 Financial Monitoring

Track daily:
- Total Value Locked (TVL)
- Utilization rate (deployed / total)
- Treasury allocation breakdown
- Share price (should only increase)
- Yield earned vs distributed

### 7.4 Security Monitoring

- [ ] Set up bug bounty program (Immunefi recommended)
- [ ] Monitor for similar protocol exploits
- [ ] Track gas prices for MEV awareness
- [ ] Watch for governance attacks on USYC

---

## 8. Emergency Procedures

### 8.1 Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Security Lead | [REDACTED] | 24/7 |
| Smart Contract Dev | [REDACTED] | 24/7 |
| Multisig Signer 1 | [REDACTED] | 24/7 |
| Legal Counsel | [REDACTED] | Business hours |
| Circle Support | [REDACTED] | 24/7 |

### 8.2 Incident Classification

| Level | Description | Response Time |
|-------|-------------|---------------|
| **P0** | Active exploit, funds at risk | Immediate |
| **P1** | Vulnerability discovered, no exploit | < 1 hour |
| **P2** | Suspicious activity, investigating | < 4 hours |
| **P3** | Non-critical issue | < 24 hours |

### 8.3 Emergency Playbooks

#### Playbook 1: Active Exploit Detected

```
1. PAUSE CONTRACTS IMMEDIATELY
   - Call pause() on LiquidityPool
   - Call pause() on TreasuryManager
   - Requires PAUSER_ROLE (should be held by hot wallet for speed)

2. ASSESS DAMAGE
   - Check TVL before/after
   - Identify affected users
   - Track attacker address

3. COMMUNICATE
   - Internal Slack: #security-incidents
   - Public: Twitter + Discord announcement
   - Do NOT disclose technical details publicly

4. REMEDIATE
   - Deploy fix if possible
   - Consider white-hat rescue if funds at risk
   - Coordinate with Circle if USDC freezing needed

5. POST-MORTEM
   - Full technical writeup
   - User compensation plan
   - Process improvements
```

#### Playbook 2: Suspicious Large Withdrawal

```
1. VERIFY AUTHORIZATION
   - Is this a known LP?
   - Is the destination address expected?
   - Was multisig used for admin functions?

2. IF UNAUTHORIZED
   - Pause contracts
   - Follow Playbook 1

3. IF AUTHORIZED
   - Log and monitor
   - No action needed
```

#### Playbook 3: USYC Protocol Issue

```
1. PAUSE USYC STRATEGY
   - TreasuryManager.pauseStrategy(usycStrategy)

2. WITHDRAW FROM USYC
   - USYCStrategy.emergencyWithdraw()
   - Returns funds to TreasuryManager

3. ASSESS IMPACT
   - Calculate any losses
   - Communicate with Hashnote team

4. DECIDE ON REDEPLOYMENT
   - Wait for USYC fix, or
   - Remove strategy permanently
```

### 8.4 Emergency Functions Reference

```solidity
// LiquidityPool
function pause() external onlyRole(PAUSER_ROLE);
function unpause() external onlyRole(PAUSER_ROLE);
function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE);

// TreasuryManager
function pause() external onlyRole(PAUSER_ROLE);
function pauseStrategy(address strategy) external onlyRole(PAUSER_ROLE);
function emergencyWithdrawFromStrategy(address strategy) external onlyRole(DEFAULT_ADMIN_ROLE);

// USYCStrategy
function emergencyWithdraw() external onlyOwner;
function deactivate() external onlyOwner;
```

---

## 9. Contract-Specific Security Concerns

### 9.1 LiquidityPool.sol

| Concern | Risk | Mitigation |
|---------|------|------------|
| ERC-4626 share inflation attack | HIGH | First depositor protection, minimum deposit |
| Reentrancy via malicious token | MEDIUM | ReentrancyGuard, SafeERC20 |
| Rounding errors in share calculation | MEDIUM | Use OpenZeppelin implementation |
| Flash loan manipulation | MEDIUM | No single-block arbitrage paths |
| Unauthorized fund deployment | HIGH | Strict role-based access |
| Treasury integration bugs | HIGH | Thorough integration testing |

**ERC-4626 Inflation Attack Mitigation:**
```solidity
// Add to constructor or first deposit
function _initialDeposit() internal {
    // Mint dead shares to prevent inflation attack
    _mint(address(0xdead), 1000);
}
```

### 9.2 TreasuryManager.sol

| Concern | Risk | Mitigation |
|---------|------|------------|
| Strategy returns less than expected | HIGH | Slippage tolerance checks |
| Malicious strategy drains funds | CRITICAL | Only add audited strategies |
| Rebalance front-running | MEDIUM | Private mempool or batching |
| Weight manipulation | MEDIUM | Access control on setWeight |
| All strategies fail simultaneously | HIGH | Keep buffer in pool |

**Strategy Whitelist Recommendation:**
```solidity
// Add to TreasuryManager
mapping(address => bool) public approvedStrategies;

function addStrategy(address strategy, uint256 weight) external {
    require(approvedStrategies[strategy], "Strategy not approved");
    // ... rest of function
}
```

### 9.3 USYCStrategy.sol

| Concern | Risk | Mitigation |
|---------|------|------------|
| USYC contract upgrade | MEDIUM | Monitor Hashnote governance |
| USYC depeg from NAV | LOW | USYC is 1:1 backed by T-bills |
| Redemption delays | MEDIUM | supportsInstantWithdraw check |
| Share price manipulation | LOW | USYC uses oracle pricing |
| USDC blacklist affects strategy | MEDIUM | Emergency withdrawal path |

### 9.4 Cross-Contract Concerns

| Concern | Risk | Mitigation |
|---------|------|------------|
| Incorrect role assignment | CRITICAL | Double-check all role grants |
| Circular dependencies | MEDIUM | Clear dependency graph |
| Upgrade coordination | HIGH | Upgrade all contracts together |
| State inconsistency | HIGH | Atomic operations where possible |

---

## 10. Timeline & Milestones

### Phase 1: Security Preparation (Weeks 1-2)

- [ ] Complete all unit tests (>95% coverage)
- [ ] Run static analysis tools (Slither, Aderyn)
- [ ] Fix all high/critical findings
- [ ] Prepare audit documentation package
- [ ] Set up Gnosis Safe multisig on Base

### Phase 2: Audit (Weeks 3-6)

- [ ] Engage primary auditor
- [ ] Address audit findings
- [ ] Re-review by auditor
- [ ] Publish final audit report
- [ ] Optional: competitive audit on Code4rena

### Phase 3: Testnet Deployment (Week 7)

- [ ] Deploy to Base Sepolia
- [ ] Full integration testing on testnet
- [ ] Invite beta users for testing
- [ ] Monitor for 1 week minimum
- [ ] Fix any issues discovered

### Phase 4: Mainnet Deployment (Week 8)

- [ ] Final code freeze
- [ ] Deploy to Base Mainnet
- [ ] Verify all contracts on Basescan
- [ ] Transfer ownership to multisig
- [ ] Initial deposit by team (small amount)

### Phase 5: Controlled Launch (Weeks 9-10)

- [ ] Enable deposits with cap ($100k initial)
- [ ] Monitor all transactions
- [ ] Gradually raise caps
- [ ] Launch bug bounty program
- [ ] Public announcement

### Phase 6: Full Launch (Week 11+)

- [ ] Remove deposit caps
- [ ] Enable all features
- [ ] Ongoing monitoring
- [ ] Regular security reviews

---

## Appendix A: Security Checklist Summary

### Pre-Audit Checklist

- [ ] Code compiles without warnings
- [ ] All tests pass with >95% coverage
- [ ] Static analysis clean (Slither, Aderyn)
- [ ] Fuzz tests run with 10k+ iterations
- [ ] Access control matrix documented
- [ ] All external calls use SafeERC20
- [ ] ReentrancyGuard on all state-changing functions
- [ ] No unbounded loops
- [ ] Custom errors instead of require strings

### Pre-Deployment Checklist

- [ ] Audit complete with no open critical/high issues
- [ ] Multisig set up and tested
- [ ] Deployment script tested on testnet
- [ ] All contract addresses documented
- [ ] Monitoring infrastructure ready
- [ ] Emergency procedures documented
- [ ] Team trained on incident response
- [ ] Bug bounty program ready

### Post-Deployment Checklist

- [ ] All contracts verified on Basescan
- [ ] Ownership transferred to multisig
- [ ] Roles correctly assigned
- [ ] Initial deposit successful
- [ ] Monitoring alerts active
- [ ] Bug bounty live
- [ ] Documentation published

---

## Appendix B: Useful Commands

```bash
# Build contracts
forge build

# Run all tests
forge test -vvv

# Run tests with coverage
forge coverage

# Run static analysis
slither contracts/src/ --config slither.config.json

# Deploy to testnet
forge script script/Deploy.s.sol:DeployMainnet --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast

# Deploy to mainnet (use with caution)
forge script script/Deploy.s.sol:DeployMainnet --rpc-url $BASE_MAINNET_RPC_URL --broadcast --verify

# Verify contract
forge verify-contract --chain-id 8453 $CONTRACT_ADDRESS src/Contract.sol:Contract

# Check contract state
cast call $CONTRACT --rpc-url $RPC_URL "functionName()(returnType)"
```

---

**Document Owner:** Security Team
**Review Frequency:** Before each deployment
**Next Review:** Before Phase 2 (Audit)
