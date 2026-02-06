/**
 * useCCTPDeposit Hook
 *
 * React hook for handling CCTP (Circle Cross-Chain Transfer Protocol) deposits.
 * Manages the complete flow: approve -> burn -> wait attestation -> claim
 */

import { useState, useCallback } from 'react';
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from 'wagmi';
import { parseUnits, formatUnits, Address, Hex } from 'viem';
import { useCCTPAttestation } from './useCCTPAttestation';

// ============ Types ============

export interface CCTPConfig {
  tokenMessenger: Address;
  messageTransmitter: Address;
  usdcAddress: Address;
  cctpReceiver: Address;
}

export interface CCTPDepositParams {
  amount: bigint;
  recipient: Address;
}

export interface CCTPDepositState {
  step: 'idle' | 'approve' | 'burn' | 'attestation' | 'claim' | 'complete' | 'error';
  approvalTxHash?: Hex;
  burnTxHash?: Hex;
  claimTxHash?: Hex;
  messageHash?: Hex;
  nonce?: bigint;
  error?: Error;
}

// ============ Chain Configurations ============

export const CCTP_CHAINS: Record<number, CCTPConfig> = {
  // Ethereum Mainnet
  1: {
    tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
    messageTransmitter: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    cctpReceiver: '0x0000000000000000000000000000000000000000', // Set after deployment
  },
  // Ethereum Sepolia
  11155111: {
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    cctpReceiver: '0x0000000000000000000000000000000000000000', // Set after deployment
  },
  // Arbitrum
  42161: {
    tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
    messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    cctpReceiver: '0x0000000000000000000000000000000000000000', // Set after deployment
  },
  // Polygon
  137: {
    tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
    messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    cctpReceiver: '0x0000000000000000000000000000000000000000', // Set after deployment
  },
  // Optimism
  10: {
    tokenMessenger: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
    messageTransmitter: '0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8',
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    cctpReceiver: '0x0000000000000000000000000000000000000000', // Set after deployment
  },
  // Avalanche
  43114: {
    tokenMessenger: '0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982',
    messageTransmitter: '0x8186359aF5F57FbB40c6b14A588d2A59C0C29880',
    usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    cctpReceiver: '0x0000000000000000000000000000000000000000', // Set after deployment
  },
};

export const CCTP_DOMAIN_IDS: Record<number, number> = {
  1: 0,       // Ethereum
  43114: 1,   // Avalanche
  10: 2,      // Optimism
  42161: 3,   // Arbitrum
  5: 5,       // Solana (not supported in wagmi)
  8453: 6,    // Base
  137: 7,     // Polygon
  84532: 6,   // Base Sepolia
  11155111: 0, // Ethereum Sepolia
  5042002: 10, // Arc Testnet (CCTP V2 domain — verify with Circle docs)
};

// Arc domain ID (destination)
const ARC_DOMAIN_ID = 10; // TODO: Verify Arc CCTP domain ID with Circle

// ============ ABIs ============

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
  },
] as const;

// ============ Hook Implementation ============

export function useCCTPDeposit(sourceChainId: number) {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [state, setState] = useState<CCTPDepositState>({ step: 'idle' });

  const config = CCTP_CHAINS[sourceChainId];
  const sourceDomainId = CCTP_DOMAIN_IDS[sourceChainId];

  // Attestation hook
  const {
    checkAttestation,
    attestation: attestationData,
    isLoading: isCheckingAttestation,
  } = useCCTPAttestation();

  // Contract writes
  const { writeContractAsync: approveAsync } = useWriteContract();
  const { writeContractAsync: burnAsync } = useWriteContract();

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: config?.usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && config ? [address, config.tokenMessenger] : undefined,
    query: {
      enabled: !!address && !!config,
    },
  });

  // Read balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: config?.usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!config,
    },
  });

  /**
   * Approve USDC spending
   */
  const approve = useCallback(async (amount: bigint) => {
    if (!config || !address) {
      throw new Error('Configuration not available');
    }

    // Switch chain if needed
    if (currentChainId !== sourceChainId) {
      await switchChainAsync({ chainId: sourceChainId });
    }

    setState(prev => ({ ...prev, step: 'approve' }));

    try {
      const hash = await approveAsync({
        address: config.usdcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [config.tokenMessenger, amount],
      });

      setState(prev => ({ ...prev, approvalTxHash: hash }));

      // Wait for confirmation
      await refetchAllowance();

      return hash;
    } catch (error) {
      setState(prev => ({ ...prev, step: 'error', error: error as Error }));
      throw error;
    }
  }, [config, address, currentChainId, sourceChainId, switchChainAsync, approveAsync, refetchAllowance]);

  /**
   * Burn USDC on source chain
   */
  const burn = useCallback(async (params: CCTPDepositParams) => {
    if (!config || !address) {
      throw new Error('Configuration not available');
    }

    // Switch chain if needed
    if (currentChainId !== sourceChainId) {
      await switchChainAsync({ chainId: sourceChainId });
    }

    setState(prev => ({ ...prev, step: 'burn' }));

    try {
      // Convert recipient address to bytes32 (left-padded)
      const mintRecipient = `0x000000000000000000000000${params.recipient.slice(2)}` as Hex;

      const hash = await burnAsync({
        address: config.tokenMessenger,
        abi: TOKEN_MESSENGER_ABI,
        functionName: 'depositForBurn',
        args: [
          params.amount,
          ARC_DOMAIN_ID,
          mintRecipient,
          config.usdcAddress,
        ],
      });

      setState(prev => ({ ...prev, burnTxHash: hash, step: 'attestation' }));

      return hash;
    } catch (error) {
      setState(prev => ({ ...prev, step: 'error', error: error as Error }));
      throw error;
    }
  }, [config, address, currentChainId, sourceChainId, switchChainAsync, burnAsync]);

  /**
   * Check if approval is needed
   */
  const needsApproval = useCallback((amount: bigint): boolean => {
    if (!allowance) return true;
    return (allowance as bigint) < amount;
  }, [allowance]);

  /**
   * Execute full deposit flow
   */
  const deposit = useCallback(async (params: CCTPDepositParams) => {
    try {
      // Step 1: Approve if needed
      if (needsApproval(params.amount)) {
        await approve(params.amount);
      }

      // Step 2: Burn USDC
      const burnHash = await burn(params);

      // Step 3: Attestation is checked separately via useCCTPAttestation
      // The user will need to wait and then call claim

      return burnHash;
    } catch (error) {
      setState(prev => ({ ...prev, step: 'error', error: error as Error }));
      throw error;
    }
  }, [needsApproval, approve, burn]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({ step: 'idle' });
  }, []);

  return {
    // State
    state,
    allowance: allowance as bigint | undefined,
    balance: balance as bigint | undefined,
    config,
    isConfigured: !!config,
    sourceDomainId,

    // Actions
    approve,
    burn,
    deposit,
    needsApproval,
    reset,

    // Refetch
    refetchAllowance,
    refetchBalance,

    // Attestation
    attestationData,
    isCheckingAttestation,
    checkAttestation,
  };
}

/**
 * Get supported source chains
 */
export function useSupportedCCTPChains() {
  return Object.entries(CCTP_CHAINS).map(([chainId, config]) => ({
    chainId: parseInt(chainId),
    domainId: CCTP_DOMAIN_IDS[parseInt(chainId)],
    ...config,
  }));
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUSDC(amount: bigint): string {
  return formatUnits(amount, 6);
}

/**
 * Parse USDC amount (6 decimals)
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, 6);
}

export default useCCTPDeposit;
