/**
 * CCTP Hooks Index
 *
 * Exports all CCTP-related hooks for cross-chain USDC deposits.
 */

export {
  useCCTPDeposit,
  useSupportedCCTPChains,
  formatUSDC,
  parseUSDC,
  CCTP_CHAINS,
  CCTP_DOMAIN_IDS,
  type CCTPConfig,
  type CCTPDepositParams,
  type CCTPDepositState,
} from './useCCTPDeposit';

export {
  useCCTPAttestation,
  useAttestationTimer,
  calculateMessageHash,
  extractMessageFromReceipt,
  type AttestationStatus,
  type AttestationResponse,
  type AttestationState,
  type UseCCTPAttestationOptions,
} from './useCCTPAttestation';
