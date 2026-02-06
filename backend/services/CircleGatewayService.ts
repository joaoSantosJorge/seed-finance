/**
 * CircleGatewayService
 *
 * Service for managing Circle Gateway on-ramp and off-ramp operations.
 * Enables fiat-to-crypto and crypto-to-fiat conversions for Seed Finance users.
 *
 * On-ramp: Bank USD -> USDC on Arc (for buyers to fund invoice repayments)
 * Off-ramp: USDC on Arc -> Bank USD (for suppliers to receive funding)
 */

import type {
  OnRampParams,
  OnRampResult,
  OffRampParams,
  OffRampResult,
  PaymentStatus,
  PaymentInstructions,
  CircleWebhookPayload,
  PaymentWebhookData,
} from '../types';

/**
 * Circle Gateway API configuration
 */
interface GatewayConfig {
  apiKey: string;
  baseUrl?: string;
  webhookSecret?: string;
}

/**
 * Internal payment record structure
 */
interface PaymentRecord {
  id: string;
  type: 'on-ramp' | 'off-ramp';
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  walletId?: string;
  bankAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Circle Gateway API response structure
 */
interface CircleApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class CircleGatewayService {
  private apiKey: string;
  private baseUrl: string;
  private webhookSecret?: string;

  // In-memory storage (replace with database in production)
  private payments: Map<string, PaymentRecord> = new Map();

  /**
   * Initialize the Circle Gateway service
   * @param config Gateway API configuration
   */
  constructor(config: GatewayConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.circle.com/v1';
    this.webhookSecret = config.webhookSecret;
  }

  // ============ On-Ramp (Fiat -> USDC) ============

  /**
   * Initiate a fiat to USDC on-ramp transaction
   * @param params On-ramp parameters
   * @returns On-ramp result with payment instructions
   */
  async initiateOnRamp(params: OnRampParams): Promise<OnRampResult> {
    try {
      // Validate parameters
      if (params.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (params.currency !== 'USD') {
        throw new Error('Only USD is supported for on-ramp');
      }

      // Create on-ramp request to Circle Gateway API
      const response = await this.makeApiRequest<{
        id: string;
        status: string;
        amount: { amount: string; currency: string };
        sourceAccount: { id: string };
        destinationAddress: string;
        instructions?: PaymentInstructions;
      }>('/businessAccount/banks/wires', {
        method: 'POST',
        body: JSON.stringify({
          amount: {
            amount: params.amount.toFixed(2),
            currency: params.currency,
          },
          destination: {
            type: 'wallet',
            id: params.destinationWalletId,
          },
          beneficiaryBank: {
            accountId: params.bankAccountId,
          },
        }),
      });

      if (!response.data) {
        throw new Error('Failed to initiate on-ramp');
      }

      // Store payment record
      const paymentRecord: PaymentRecord = {
        id: response.data.id,
        type: 'on-ramp',
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        status: 'AWAITING_FUNDS',
        walletId: params.destinationWalletId,
        bankAccountId: params.bankAccountId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.payments.set(paymentRecord.id, paymentRecord);

      return {
        paymentId: response.data.id,
        status: 'AWAITING_FUNDS',
        estimatedArrival: this.estimateArrival('on-ramp'),
        instructions: response.data.instructions,
      };
    } catch (error) {
      console.error('Error initiating on-ramp:', error);
      throw new Error(`Failed to initiate on-ramp: ${(error as Error).message}`);
    }
  }

  /**
   * Get bank wire instructions for on-ramp
   * @param paymentId Payment ID from initiateOnRamp
   * @returns Payment instructions for bank wire
   */
  async getWireInstructions(paymentId: string): Promise<PaymentInstructions> {
    try {
      const response = await this.makeApiRequest<{
        id: string;
        beneficiaryName: string;
        beneficiaryAddress: string;
        bankName: string;
        bankAddress: string;
        accountNumber: string;
        routingNumber: string;
        reference: string;
      }>(`/businessAccount/banks/wires/${paymentId}/instructions`);

      if (!response.data) {
        throw new Error('Failed to get wire instructions');
      }

      return {
        beneficiaryName: response.data.beneficiaryName,
        beneficiaryAddress: response.data.beneficiaryAddress,
        bankName: response.data.bankName,
        bankAddress: response.data.bankAddress,
        accountNumber: response.data.accountNumber,
        routingNumber: response.data.routingNumber,
        reference: response.data.reference,
      };
    } catch (error) {
      console.error('Error getting wire instructions:', error);
      throw new Error(`Failed to get wire instructions: ${(error as Error).message}`);
    }
  }

  // ============ Off-Ramp (USDC -> Fiat) ============

  /**
   * Initiate a USDC to fiat off-ramp transaction
   * @param params Off-ramp parameters
   * @returns Off-ramp result
   */
  async initiateOffRamp(params: OffRampParams): Promise<OffRampResult> {
    try {
      // Validate parameters
      if (params.amount <= 0n) {
        throw new Error('Amount must be greater than 0');
      }

      // Convert bigint to USDC amount (6 decimals)
      const usdcAmount = Number(params.amount) / 1_000_000;

      // Create off-ramp request to Circle Gateway API
      const response = await this.makeApiRequest<{
        id: string;
        status: string;
        amount: { amount: string; currency: string };
        sourceWalletId: string;
        destinationBank: { id: string };
      }>('/payouts', {
        method: 'POST',
        body: JSON.stringify({
          source: {
            type: 'wallet',
            id: params.sourceWalletId,
          },
          destination: {
            type: 'wire',
            bankAccountId: params.bankAccountId,
          },
          amount: {
            amount: usdcAmount.toFixed(2),
            currency: 'USD',
          },
        }),
      });

      if (!response.data) {
        throw new Error('Failed to initiate off-ramp');
      }

      // Store payment record
      const paymentRecord: PaymentRecord = {
        id: response.data.id,
        type: 'off-ramp',
        userId: params.userId,
        amount: usdcAmount,
        currency: 'USD',
        status: 'PROCESSING',
        walletId: params.sourceWalletId,
        bankAccountId: params.bankAccountId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.payments.set(paymentRecord.id, paymentRecord);

      return {
        payoutId: response.data.id,
        status: 'PROCESSING',
        estimatedArrival: this.estimateArrival('off-ramp'),
      };
    } catch (error) {
      console.error('Error initiating off-ramp:', error);
      throw new Error(`Failed to initiate off-ramp: ${(error as Error).message}`);
    }
  }

  // ============ Payment Status ============

  /**
   * Get payment status
   * @param paymentId Payment or payout ID
   * @returns Current payment status
   */
  async getPaymentStatus(paymentId: string): Promise<{
    id: string;
    type: 'on-ramp' | 'off-ramp';
    status: PaymentStatus;
    amount: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    // Check local cache first
    const cached = this.payments.get(paymentId);
    if (cached) {
      return {
        id: cached.id,
        type: cached.type,
        status: cached.status,
        amount: cached.amount,
        currency: cached.currency,
        createdAt: cached.createdAt,
        updatedAt: cached.updatedAt,
      };
    }

    // Fetch from API
    try {
      // Try wire endpoint first (on-ramp)
      const wireResponse = await this.makeApiRequest<{
        id: string;
        status: string;
        amount: { amount: string; currency: string };
        createDate: string;
        updateDate: string;
      }>(`/businessAccount/banks/wires/${paymentId}`);

      if (wireResponse.data) {
        return {
          id: wireResponse.data.id,
          type: 'on-ramp',
          status: this.mapCircleStatus(wireResponse.data.status),
          amount: parseFloat(wireResponse.data.amount.amount),
          currency: wireResponse.data.amount.currency,
          createdAt: new Date(wireResponse.data.createDate),
          updatedAt: new Date(wireResponse.data.updateDate),
        };
      }

      // Try payout endpoint (off-ramp)
      const payoutResponse = await this.makeApiRequest<{
        id: string;
        status: string;
        amount: { amount: string; currency: string };
        createDate: string;
        updateDate: string;
      }>(`/payouts/${paymentId}`);

      if (payoutResponse.data) {
        return {
          id: payoutResponse.data.id,
          type: 'off-ramp',
          status: this.mapCircleStatus(payoutResponse.data.status),
          amount: parseFloat(payoutResponse.data.amount.amount),
          currency: payoutResponse.data.amount.currency,
          createdAt: new Date(payoutResponse.data.createDate),
          updatedAt: new Date(payoutResponse.data.updateDate),
        };
      }

      throw new Error('Payment not found');
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw new Error(`Failed to get payment status: ${(error as Error).message}`);
    }
  }

  // ============ Webhook Handlers ============

  /**
   * Handle incoming Circle webhook
   * @param payload Raw webhook payload
   * @param signature Webhook signature header
   * @returns Parsed webhook data
   */
  async handleWebhook(
    payload: CircleWebhookPayload,
    signature?: string
  ): Promise<PaymentWebhookData | null> {
    // Verify signature if webhook secret is configured
    if (this.webhookSecret && signature) {
      const isValid = this.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }
    }

    // Route to appropriate handler based on event type
    switch (payload.type) {
      case 'wire.incoming.complete':
        return this.handleOnRampComplete(payload);
      case 'wire.incoming.failed':
        return this.handleOnRampFailed(payload);
      case 'payout.complete':
        return this.handleOffRampComplete(payload);
      case 'payout.failed':
        return this.handleOffRampFailed(payload);
      default:
        console.log(`Unhandled webhook type: ${payload.type}`);
        return null;
    }
  }

  /**
   * Handle on-ramp completion webhook
   */
  async handleOnRampComplete(payload: CircleWebhookPayload): Promise<PaymentWebhookData> {
    const data = payload.data as {
      id: string;
      amount: { amount: string; currency: string };
      destination?: { address: string };
    };

    // Update local cache
    const payment = this.payments.get(data.id);
    if (payment) {
      payment.status = 'COMPLETED';
      payment.updatedAt = new Date();
    }

    console.log(`On-ramp completed: ${data.id}, amount: ${data.amount.amount}`);

    return {
      paymentId: data.id,
      status: 'COMPLETED',
      amount: data.amount.amount,
      currency: data.amount.currency,
      walletId: data.destination?.address,
    };
  }

  /**
   * Handle on-ramp failure webhook
   */
  async handleOnRampFailed(payload: CircleWebhookPayload): Promise<PaymentWebhookData> {
    const data = payload.data as {
      id: string;
      amount: { amount: string; currency: string };
      errorCode?: string;
      errorMessage?: string;
    };

    // Update local cache
    const payment = this.payments.get(data.id);
    if (payment) {
      payment.status = 'FAILED';
      payment.updatedAt = new Date();
      payment.metadata = {
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      };
    }

    console.error(`On-ramp failed: ${data.id}, error: ${data.errorMessage}`);

    return {
      paymentId: data.id,
      status: 'FAILED',
      amount: data.amount.amount,
      currency: data.amount.currency,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    };
  }

  /**
   * Handle off-ramp completion webhook
   */
  async handleOffRampComplete(payload: CircleWebhookPayload): Promise<PaymentWebhookData> {
    const data = payload.data as {
      id: string;
      amount: { amount: string; currency: string };
      destination?: { id: string };
      txHash?: string;
    };

    // Update local cache
    const payment = this.payments.get(data.id);
    if (payment) {
      payment.status = 'COMPLETED';
      payment.updatedAt = new Date();
    }

    console.log(`Off-ramp completed: ${data.id}, amount: ${data.amount.amount}`);

    return {
      paymentId: data.id,
      status: 'COMPLETED',
      amount: data.amount.amount,
      currency: data.amount.currency,
      bankAccountId: data.destination?.id,
      txHash: data.txHash,
    };
  }

  /**
   * Handle off-ramp failure webhook
   */
  async handleOffRampFailed(payload: CircleWebhookPayload): Promise<PaymentWebhookData> {
    const data = payload.data as {
      id: string;
      amount: { amount: string; currency: string };
      errorCode?: string;
      errorMessage?: string;
    };

    // Update local cache
    const payment = this.payments.get(data.id);
    if (payment) {
      payment.status = 'FAILED';
      payment.updatedAt = new Date();
      payment.metadata = {
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      };
    }

    console.error(`Off-ramp failed: ${data.id}, error: ${data.errorMessage}`);

    return {
      paymentId: data.id,
      status: 'FAILED',
      amount: data.amount.amount,
      currency: data.amount.currency,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    };
  }

  // ============ Utility Functions ============

  /**
   * Make an API request to Circle
   */
  private async makeApiRequest<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<CircleApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Map Circle status to internal PaymentStatus
   */
  private mapCircleStatus(circleStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      pending: 'PENDING',
      awaiting_funds: 'AWAITING_FUNDS',
      processing: 'PROCESSING',
      complete: 'COMPLETED',
      failed: 'FAILED',
      cancelled: 'CANCELLED',
    };

    return statusMap[circleStatus.toLowerCase()] || 'PENDING';
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(
    payload: CircleWebhookPayload,
    signature: string
  ): boolean {
    // In production, implement proper HMAC signature verification
    // using the webhook secret
    if (!this.webhookSecret) {
      return true;
    }

    // Placeholder - implement actual signature verification
    console.log('Verifying webhook signature:', signature.substring(0, 20) + '...');
    return true;
  }

  /**
   * Estimate arrival time based on payment type
   */
  private estimateArrival(type: 'on-ramp' | 'off-ramp'): Date {
    const now = new Date();

    if (type === 'on-ramp') {
      // ACH typically 2-3 business days, wire 1 day
      now.setDate(now.getDate() + 2);
    } else {
      // Off-ramp typically 1-2 business days
      now.setDate(now.getDate() + 1);
    }

    return now;
  }

  /**
   * Get all payments for a user
   */
  getPaymentsByUser(userId: string): PaymentRecord[] {
    return Array.from(this.payments.values()).filter((p) => p.userId === userId);
  }
}

export default CircleGatewayService;
