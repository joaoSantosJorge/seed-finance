/**
 * useCCTPAttestation Hook
 *
 * React hook for checking and retrieving CCTP attestations from Circle's
 * attestation service. Used to verify that a burn transaction on the source
 * chain has been attested and can be claimed on the destination chain.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Hex, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

// ============ Types ============

export type AttestationStatus =
  | 'pending_confirmations'
  | 'pending'
  | 'complete'
  | 'failed'
  | 'unknown';

export interface AttestationResponse {
  status: AttestationStatus;
  attestation?: Hex;
  message?: Hex;
}

export interface AttestationState {
  status: AttestationStatus;
  attestation?: Hex;
  message?: Hex;
  messageHash?: Hex;
  error?: Error;
  attempts: number;
  lastChecked?: Date;
}

export interface UseCCTPAttestationOptions {
  /**
   * Polling interval in milliseconds (default: 15000 = 15 seconds)
   */
  pollingInterval?: number;

  /**
   * Maximum polling attempts before giving up (default: 80 = ~20 minutes)
   */
  maxAttempts?: number;

  /**
   * Whether to use sandbox API (default: true for development)
   */
  useSandbox?: boolean;
}

// ============ Constants ============

const ATTESTATION_API = {
  production: 'https://iris-api.circle.com/attestations',
  sandbox: 'https://iris-api-sandbox.circle.com/attestations',
};

const DEFAULT_OPTIONS: Required<UseCCTPAttestationOptions> = {
  pollingInterval: 15000, // 15 seconds
  maxAttempts: 80, // ~20 minutes total
  useSandbox: true,
};

// ============ Helper Functions ============

/**
 * Calculate message hash from CCTP message bytes
 * This is used to query the attestation API
 */
export function calculateMessageHash(message: Hex): Hex {
  return keccak256(message);
}

/**
 * Extract message from burn transaction receipt
 * The message is emitted as an event from the MessageTransmitter contract
 */
export function extractMessageFromReceipt(
  receipt: {
    logs: Array<{
      topics: readonly Hex[];
      data: Hex;
    }>;
  },
  messageTransmitterAddress: string
): Hex | null {
  // MessageSent event signature: MessageSent(bytes message)
  const MESSAGE_SENT_TOPIC = keccak256(
    encodeAbiParameters(parseAbiParameters('string'), ['MessageSent(bytes)'])
  );

  for (const log of receipt.logs) {
    // Check if this is a MessageSent event from MessageTransmitter
    if (
      log.topics[0]?.toLowerCase() === MESSAGE_SENT_TOPIC.toLowerCase()
    ) {
      // The message is in the log data
      // It's ABI encoded as bytes, so we need to decode it
      try {
        // Skip the first 64 characters (32 bytes offset + 32 bytes length)
        const messageLength = parseInt(log.data.slice(66, 130), 16) * 2;
        const message = `0x${log.data.slice(130, 130 + messageLength)}` as Hex;
        return message;
      } catch {
        continue;
      }
    }
  }

  return null;
}

// ============ Hook Implementation ============

export function useCCTPAttestation(options?: UseCCTPAttestationOptions) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<AttestationState>({
    status: 'unknown',
    attempts: 0,
  });

  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Check attestation status for a message hash
   */
  const checkAttestation = useCallback(
    async (messageHash: Hex): Promise<AttestationResponse> => {
      const apiUrl = opts.useSandbox
        ? ATTESTATION_API.sandbox
        : ATTESTATION_API.production;

      try {
        const response = await fetch(`${apiUrl}/${messageHash}`, {
          signal: abortRef.current?.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { status: 'pending' };
          }
          throw new Error(`Attestation API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'complete') {
          return {
            status: 'complete',
            attestation: data.attestation as Hex,
            message: data.message as Hex,
          };
        }

        return {
          status: data.status as AttestationStatus,
        };
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw error;
        }

        console.error('Error checking attestation:', error);
        return { status: 'unknown' };
      }
    },
    [opts.useSandbox]
  );

  /**
   * Start polling for attestation
   */
  const startPolling = useCallback(
    async (messageHash: Hex, message?: Hex) => {
      // Cancel any existing polling
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }

      abortRef.current = new AbortController();
      setIsPolling(true);

      setState({
        status: 'pending',
        messageHash,
        message,
        attempts: 0,
      });

      const poll = async () => {
        setState((prev) => ({
          ...prev,
          attempts: prev.attempts + 1,
          lastChecked: new Date(),
        }));

        try {
          const result = await checkAttestation(messageHash);

          if (result.status === 'complete') {
            setState((prev) => ({
              ...prev,
              status: 'complete',
              attestation: result.attestation,
              message: result.message || prev.message,
            }));
            setIsPolling(false);
            return;
          }

          // Check if we've exceeded max attempts
          setState((prev) => {
            if (prev.attempts >= opts.maxAttempts) {
              setIsPolling(false);
              return {
                ...prev,
                status: 'failed',
                error: new Error('Attestation timeout - max attempts reached'),
              };
            }
            return {
              ...prev,
              status: result.status,
            };
          });

          // Continue polling if not complete and not at max attempts
          if (state.attempts < opts.maxAttempts) {
            pollingRef.current = setTimeout(poll, opts.pollingInterval);
          }
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            return;
          }

          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: error as Error,
          }));
          setIsPolling(false);
        }
      };

      // Start polling immediately
      await poll();
    },
    [checkAttestation, opts.maxAttempts, opts.pollingInterval, state.attempts]
  );

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsPolling(false);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    stopPolling();
    setState({
      status: 'unknown',
      attempts: 0,
    });
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    attestation: state,
    isPolling,
    isComplete: state.status === 'complete',
    isFailed: state.status === 'failed',
    isPending: state.status === 'pending' || state.status === 'pending_confirmations',
    isLoading: isPolling,

    // Actions
    checkAttestation,
    startPolling,
    stopPolling,
    reset,

    // Helpers
    calculateMessageHash,
    extractMessageFromReceipt,
  };
}

// ============ Utility Hook for Estimated Time ============

/**
 * Hook to display estimated time remaining for attestation
 */
export function useAttestationTimer(startTime?: Date) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Typical attestation takes 13-19 minutes
  const estimatedTotal = 15 * 60; // 15 minutes in seconds
  const remaining = Math.max(0, estimatedTotal - elapsed);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    elapsed,
    remaining,
    estimatedTotal,
    elapsedFormatted: formatTime(elapsed),
    remainingFormatted: formatTime(remaining),
    progress: Math.min(100, (elapsed / estimatedTotal) * 100),
  };
}

export default useCCTPAttestation;
