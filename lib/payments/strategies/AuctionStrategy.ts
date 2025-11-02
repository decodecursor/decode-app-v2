/**
 * Auction Strategy
 * Payment strategy for MODEL user auctions with pre-authorization
 */

import Stripe from 'stripe';
import {
  IPaymentStrategy,
  PaymentContext,
  PaymentResult,
  RefundResult,
} from '../core/PaymentStrategy.interface';
import { getAuctionConfig } from '../config/paymentConfig';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export interface AuctionPaymentContext extends PaymentContext {
  auction_id: string;
  bid_id: string;
  bidder_email: string;
  bidder_name: string;
  is_guest: boolean;
  guest_stripe_customer_id?: string;
}

export class AuctionStrategy implements IPaymentStrategy {
  private config = getAuctionConfig();

  getName(): string {
    return 'auction';
  }

  canHandle(context: PaymentContext): boolean {
    // This strategy handles auction-related payments
    return 'auction_id' in context && this.config.enabled;
  }

  /**
   * Create a Stripe PaymentIntent with manual capture for pre-authorization
   */
  async createPayment(context: PaymentContext): Promise<PaymentResult> {
    try {
      const auctionContext = context as AuctionPaymentContext;

      // Get or create Stripe customer for guest bidders
      let customerId: string | undefined = auctionContext.guest_stripe_customer_id;

      if (auctionContext.is_guest && !customerId) {
        const customer = await stripe.customers.create({
          email: auctionContext.bidder_email,
          name: auctionContext.bidder_name,
          metadata: {
            is_guest_bidder: 'true',
            auction_id: auctionContext.auction_id,
          },
        });
        customerId = customer.id;
      }

      // Create PaymentIntent with manual capture (pre-authorization)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(context.amount * 100), // Convert to cents
        currency: 'usd',
        customer: customerId || auctionContext.user_id,
        capture_method: 'manual', // Pre-authorize only, capture later
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never', // Prevent redirect-based payment methods
        },
        metadata: {
          type: 'auction_bid',
          auction_id: auctionContext.auction_id,
          bid_id: auctionContext.bid_id,
          bidder_email: auctionContext.bidder_email,
          bidder_name: auctionContext.bidder_name,
          is_guest: auctionContext.is_guest.toString(),
        },
        description: `Bid on auction: ${context.description || auctionContext.auction_id}`,
      });

      return {
        success: true,
        payment_intent_id: paymentIntent.id,
        metadata: {
          client_secret: paymentIntent.client_secret,
          stripe_customer_id: customerId,
        },
      };
    } catch (error) {
      console.error('Auction payment creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      };
    }
  }

  /**
   * Capture a pre-authorized payment
   */
  async capturePayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

      return {
        success: true,
        payment_intent_id: paymentIntent.id,
        metadata: {
          amount: paymentIntent.amount,
          status: paymentIntent.status,
        },
      };
    } catch (error) {
      console.error('Auction payment capture error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture payment',
      };
    }
  }

  /**
   * Cancel a pre-authorized payment
   */
  async cancelPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      return {
        success: true,
        payment_intent_id: paymentIntent.id,
        metadata: {
          status: paymentIntent.status,
        },
      };
    } catch (error) {
      console.error('Auction payment cancellation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel payment',
      };
    }
  }

  /**
   * Handle Stripe webhook events for auctions
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    // Only process auction-related events
    if (event.type.startsWith('payment_intent.')) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Check if this is an auction payment
      if (paymentIntent.metadata?.type !== 'auction_bid') {
        return;
      }

      switch (event.type) {
        case 'payment_intent.amount_capturable_updated':
          await this.handleAmountCapturableUpdated(paymentIntent);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(paymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(paymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(paymentIntent);
          break;

        default:
          console.log(`Unhandled auction event type: ${event.type}`);
      }
    }
  }

  /**
   * Refund a captured payment
   */
  async refundPayment(paymentIntentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        success: true,
        refund_id: refund.id,
        amount_refunded: refund.amount / 100,
      };
    } catch (error) {
      console.error('Auction refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refund payment',
      };
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Private webhook handlers
   */
  private async handleAmountCapturableUpdated(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Auction bid pre-authorized:', {
      payment_intent_id: paymentIntent.id,
      auction_id: paymentIntent.metadata.auction_id,
      amount: paymentIntent.amount / 100,
    });

    // Update bid status in database
    // This will be handled by the BiddingService
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Auction payment captured successfully:', {
      payment_intent_id: paymentIntent.id,
      auction_id: paymentIntent.metadata.auction_id,
      amount_captured: paymentIntent.amount_captured! / 100,
    });

    // Update auction and payout records
    // This will be handled by the AuctionService
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.error('Auction payment failed:', {
      payment_intent_id: paymentIntent.id,
      auction_id: paymentIntent.metadata.auction_id,
      error: paymentIntent.last_payment_error?.message,
    });

    // Mark bid as failed and attempt fallback to second highest bid
    // This will be handled by the BiddingService
  }

  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Auction payment canceled:', {
      payment_intent_id: paymentIntent.id,
      auction_id: paymentIntent.metadata.auction_id,
    });

    // Update bid status to canceled
    // This will be handled by the BiddingService
  }

  /**
   * Get pre-auth expiry time (7 days from now)
   */
  getPreAuthExpiryTime(): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.config.settings.preAuthDuration);
    return expiryDate;
  }
}
