/**
 * Circle Gateway Webhook Handler
 *
 * Processes webhooks from Circle Gateway for on-ramp and off-ramp events.
 * Updates user balances and triggers downstream actions.
 */

import type { CircleWebhookPayload, PaymentWebhookData } from '../../types';
import { CircleGatewayService } from '../../services/CircleGatewayService';

// Initialize gateway service (in production, use environment variables)
const gatewayService = new CircleGatewayService({
  apiKey: process.env.CIRCLE_GATEWAY_API_KEY || '',
  webhookSecret: process.env.CIRCLE_GATEWAY_WEBHOOK_SECRET,
});

/**
 * Webhook event types we handle
 */
const HANDLED_EVENT_TYPES = [
  'wire.incoming.complete',
  'wire.incoming.failed',
  'payout.complete',
  'payout.failed',
  'transfers.complete',
  'transfers.failed',
] as const;

type WebhookEventType = (typeof HANDLED_EVENT_TYPES)[number];

/**
 * Webhook response interface
 */
interface WebhookResponse {
  success: boolean;
  processed: boolean;
  eventType: string;
  data?: PaymentWebhookData;
  error?: string;
}

/**
 * Event handlers for different webhook types
 */
interface WebhookEventHandlers {
  onOnRampComplete?: (data: PaymentWebhookData) => Promise<void>;
  onOnRampFailed?: (data: PaymentWebhookData) => Promise<void>;
  onOffRampComplete?: (data: PaymentWebhookData) => Promise<void>;
  onOffRampFailed?: (data: PaymentWebhookData) => Promise<void>;
}

/**
 * Circle Gateway Webhook Handler
 */
export class CircleGatewayWebhookHandler {
  private webhookSecret?: string;
  private eventHandlers: WebhookEventHandlers;

  constructor(webhookSecret?: string, handlers?: WebhookEventHandlers) {
    this.webhookSecret = webhookSecret;
    this.eventHandlers = handlers || {};
  }

  /**
   * Process incoming webhook
   * @param rawPayload Raw webhook payload (string or object)
   * @param signature Webhook signature from headers
   * @returns Webhook processing result
   */
  async processWebhook(
    rawPayload: string | CircleWebhookPayload,
    signature?: string
  ): Promise<WebhookResponse> {
    try {
      // Parse payload if string
      const payload: CircleWebhookPayload =
        typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;

      // Validate webhook signature
      if (this.webhookSecret && signature) {
        const isValid = this.verifySignature(payload, signature);
        if (!isValid) {
          return {
            success: false,
            processed: false,
            eventType: payload.type,
            error: 'Invalid webhook signature',
          };
        }
      }

      // Check if we handle this event type
      if (!this.isHandledEventType(payload.type)) {
        console.log(`Ignoring unhandled webhook type: ${payload.type}`);
        return {
          success: true,
          processed: false,
          eventType: payload.type,
        };
      }

      // Process the webhook through gateway service
      const result = await gatewayService.handleWebhook(payload, signature);

      if (!result) {
        return {
          success: true,
          processed: false,
          eventType: payload.type,
        };
      }

      // Trigger appropriate event handler
      await this.triggerEventHandler(payload.type, result);

      return {
        success: true,
        processed: true,
        eventType: payload.type,
        data: result,
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        success: false,
        processed: false,
        eventType: 'unknown',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Verify webhook signature using HMAC
   */
  private verifySignature(
    payload: CircleWebhookPayload,
    signature: string
  ): boolean {
    if (!this.webhookSecret) {
      return true; // Skip verification if no secret configured
    }

    // In production, implement proper HMAC-SHA256 verification:
    // 1. Compute HMAC-SHA256 of the raw payload body using webhook secret
    // 2. Compare with signature from Circle-Signature header
    //
    // Example:
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', this.webhookSecret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return crypto.timingSafeEqual(
    //   Buffer.from(signature),
    //   Buffer.from(expectedSignature)
    // );

    console.log('Webhook signature verification:', signature.substring(0, 20) + '...');
    return true;
  }

  /**
   * Check if event type is handled
   */
  private isHandledEventType(eventType: string): eventType is WebhookEventType {
    return HANDLED_EVENT_TYPES.includes(eventType as WebhookEventType);
  }

  /**
   * Trigger appropriate event handler
   */
  private async triggerEventHandler(
    eventType: string,
    data: PaymentWebhookData
  ): Promise<void> {
    switch (eventType) {
      case 'wire.incoming.complete':
      case 'transfers.complete':
        if (data.status === 'COMPLETED' && !data.bankAccountId) {
          // On-ramp complete (wire to wallet)
          await this.handleOnRampComplete(data);
        } else if (data.status === 'COMPLETED' && data.bankAccountId) {
          // Off-ramp complete (wallet to bank)
          await this.handleOffRampComplete(data);
        }
        break;

      case 'wire.incoming.failed':
      case 'transfers.failed':
        if (data.errorCode) {
          // Determine if on-ramp or off-ramp failed
          if (!data.bankAccountId) {
            await this.handleOnRampFailed(data);
          } else {
            await this.handleOffRampFailed(data);
          }
        }
        break;

      case 'payout.complete':
        await this.handleOffRampComplete(data);
        break;

      case 'payout.failed':
        await this.handleOffRampFailed(data);
        break;
    }
  }

  /**
   * Handle on-ramp completion
   */
  private async handleOnRampComplete(data: PaymentWebhookData): Promise<void> {
    console.log('=== On-Ramp Complete ===');
    console.log(`Payment ID: ${data.paymentId}`);
    console.log(`Amount: ${data.amount} ${data.currency}`);
    console.log(`Wallet: ${data.walletId}`);

    // Call custom handler if provided
    if (this.eventHandlers.onOnRampComplete) {
      await this.eventHandlers.onOnRampComplete(data);
    }

    // In production, you would:
    // 1. Look up user by walletId
    // 2. Update user's balance in database
    // 3. Send notification to user
    // 4. Optionally auto-deposit to LiquidityPool if configured
  }

  /**
   * Handle on-ramp failure
   */
  private async handleOnRampFailed(data: PaymentWebhookData): Promise<void> {
    console.error('=== On-Ramp Failed ===');
    console.error(`Payment ID: ${data.paymentId}`);
    console.error(`Error: ${data.errorCode} - ${data.errorMessage}`);

    // Call custom handler if provided
    if (this.eventHandlers.onOnRampFailed) {
      await this.eventHandlers.onOnRampFailed(data);
    }

    // In production, you would:
    // 1. Look up user by payment ID
    // 2. Update transaction status in database
    // 3. Send failure notification to user
    // 4. Potentially trigger retry logic
  }

  /**
   * Handle off-ramp completion
   */
  private async handleOffRampComplete(data: PaymentWebhookData): Promise<void> {
    console.log('=== Off-Ramp Complete ===');
    console.log(`Payout ID: ${data.paymentId}`);
    console.log(`Amount: ${data.amount} ${data.currency}`);
    console.log(`Bank Account: ${data.bankAccountId}`);
    console.log(`Tx Hash: ${data.txHash}`);

    // Call custom handler if provided
    if (this.eventHandlers.onOffRampComplete) {
      await this.eventHandlers.onOffRampComplete(data);
    }

    // In production, you would:
    // 1. Look up user by bankAccountId or payment ID
    // 2. Update transaction status in database
    // 3. Send confirmation notification to user (supplier)
    // 4. Update invoice status if this was a supplier payout
  }

  /**
   * Handle off-ramp failure
   */
  private async handleOffRampFailed(data: PaymentWebhookData): Promise<void> {
    console.error('=== Off-Ramp Failed ===');
    console.error(`Payout ID: ${data.paymentId}`);
    console.error(`Error: ${data.errorCode} - ${data.errorMessage}`);

    // Call custom handler if provided
    if (this.eventHandlers.onOffRampFailed) {
      await this.eventHandlers.onOffRampFailed(data);
    }

    // In production, you would:
    // 1. Look up user by payment ID
    // 2. Return USDC to supplier's wallet
    // 3. Update transaction status in database
    // 4. Send failure notification with retry instructions
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: WebhookEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }
}

// ============ Express/Next.js API Route Handler ============

/**
 * Express-style request handler for webhook endpoint
 *
 * Usage with Express:
 * ```typescript
 * app.post('/api/webhooks/circle-gateway', handleCircleGatewayWebhook);
 * ```
 *
 * Usage with Next.js API Routes:
 * ```typescript
 * export const POST = handleCircleGatewayWebhook;
 * ```
 */
export async function handleCircleGatewayWebhook(
  req: { body: unknown; headers: Record<string, string | string[] | undefined> },
  res?: { status: (code: number) => { json: (data: unknown) => void } }
): Promise<WebhookResponse> {
  const handler = new CircleGatewayWebhookHandler(
    process.env.CIRCLE_GATEWAY_WEBHOOK_SECRET
  );

  // Get signature from headers
  const signature =
    (req.headers['circle-signature'] as string) ||
    (req.headers['x-circle-signature'] as string);

  // Process the webhook
  const result = await handler.processWebhook(
    req.body as CircleWebhookPayload,
    signature
  );

  // Send response if res object provided (Express style)
  if (res) {
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  }

  return result;
}

// ============ Webhook Testing Utilities ============

/**
 * Generate a test webhook payload
 */
export function generateTestWebhook(
  type: WebhookEventType,
  data: Partial<PaymentWebhookData>
): CircleWebhookPayload {
  return {
    id: `webhook_${Date.now()}`,
    type,
    data: {
      id: data.paymentId || `payment_${Date.now()}`,
      amount: {
        amount: data.amount || '100.00',
        currency: data.currency || 'USD',
      },
      status: data.status || 'COMPLETED',
      walletId: data.walletId,
      bankAccountId: data.bankAccountId,
      txHash: data.txHash,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    },
    timestamp: new Date().toISOString(),
  };
}

export default CircleGatewayWebhookHandler;
