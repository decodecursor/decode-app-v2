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
import { getAuctionConfig, PAYMENT_CONFIG } from '../config/paymentConfig';
import { GuestBidderService } from '@/lib/services/GuestBidderService';
import { createServiceRoleClient } from '@/utils/supabase/service-role';

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
  guest_bidder_id?: string;
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

        // CRITICAL: Save customer ID to database immediately (Edge browser fix)
        if (auctionContext.guest_bidder_id) {
          const guestService = new GuestBidderService();
          await guestService.updateStripeCustomerId(auctionContext.guest_bidder_id, customerId);
          console.log('[AuctionStrategy] Saved new Stripe customer ID for guest bidder:', {
            guest_bidder_id: auctionContext.guest_bidder_id,
            customer_id: customerId,
          });
        }
      }

      // Check for saved payment method for guest bidders with Stripe fallback
      // Use saved payment method for ANY returning guest bidder (not auction-specific)
      let savedPaymentMethodId: string | null = null;
      if (auctionContext.is_guest && auctionContext.guest_bidder_id) {
        console.log('[AuctionStrategy] Checking saved payment for guest bidder:', {
          guest_bidder_id: auctionContext.guest_bidder_id,
          auction_id: auctionContext.auction_id,
        });

        const guestService = new GuestBidderService();

        // Simply check if guest has ANY saved payment method (not auction-specific)
        savedPaymentMethodId = await guestService.getSavedPaymentMethod(auctionContext.guest_bidder_id);

        console.log('[AuctionStrategy] Saved payment method check:', {
          payment_method_id: savedPaymentMethodId,
          has_saved_payment: !!savedPaymentMethodId,
          guest_bidder_id: auctionContext.guest_bidder_id,
        });

        // REMOVED: Stripe fallback was causing first bids to auto-confirm with old payment methods
        // The database should be the single source of truth for saved payment methods
        // This prevents confusion where old Stripe data overrides the intentional database state

        if (savedPaymentMethodId) {
          console.log('[AuctionStrategy] Using saved payment method:', {
            payment_method_id: savedPaymentMethodId,
            source: savedPaymentMethodId ? 'database/stripe' : 'none',
            guest_bidder_id: auctionContext.guest_bidder_id,
          });
        }
      }

      // Convert AED amount to USD (Stripe doesn't support AED directly)
      const aedAmount = context.amount;
      const usdAmount = aedAmount / PAYMENT_CONFIG.currency.AED_TO_USD_RATE;
      const usdCents = Math.round(usdAmount * 100);

      // Validate Stripe minimum charge amount ($0.50 USD)
      const STRIPE_MINIMUM_USD = 0.50;
      if (usdAmount < STRIPE_MINIMUM_USD) {
        const minimumAED = Math.ceil(STRIPE_MINIMUM_USD * PAYMENT_CONFIG.currency.AED_TO_USD_RATE);
        return {
          success: false,
          error: `Bid amount too low. Minimum bid is AED ${minimumAED} (Stripe minimum charge is $${STRIPE_MINIMUM_USD} USD)`,
        };
      }

      // Create PaymentIntent with manual capture (pre-authorization)
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: usdCents, // Amount in USD cents
        currency: 'usd',
        customer: customerId || undefined,
        capture_method: 'manual', // Pre-authorize only, capture later
        // Only set setup_future_usage when NO saved payment method exists
        // Cannot use both setup_future_usage and off_session=true together
        ...(savedPaymentMethodId ? {} : { setup_future_usage: 'off_session' }),
        metadata: {
          type: 'auction_bid',
          auction_id: auctionContext.auction_id,
          bid_id: auctionContext.bid_id,
          bidder_email: auctionContext.bidder_email,
          bidder_name: auctionContext.bidder_name,
          is_guest: auctionContext.is_guest.toString(),
          guest_bidder_id: auctionContext.guest_bidder_id || '',
          original_amount_aed: aedAmount.toString(),
          converted_amount_usd: usdAmount.toFixed(2),
        },
        description: `Bid on auction: ${context.description || auctionContext.auction_id}`,
      };

      // If saved payment method exists, attach it and confirm automatically
      if (savedPaymentMethodId) {
        paymentIntentParams.payment_method = savedPaymentMethodId;
        paymentIntentParams.confirm = true;
        paymentIntentParams.off_session = true;
      } else {
        // For new payment methods, enable automatic payment methods
        paymentIntentParams.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never', // Prevent redirect-based payment methods
        };
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      const hasSavedPaymentMethod = !!savedPaymentMethodId;

      // Get card last4 if we have a saved payment method
      let savedCardLast4: string | undefined;
      if (savedPaymentMethodId) {
        try {
          const paymentMethod = await stripe.paymentMethods.retrieve(savedPaymentMethodId);
          savedCardLast4 = paymentMethod.card?.last4;
        } catch (error) {
          console.error('[AuctionStrategy] Error fetching payment method details:', error);
        }
      }

      console.log('[AuctionStrategy] Payment created - returning response:', {
        payment_intent_id: paymentIntent.id,
        has_saved_payment_method: hasSavedPaymentMethod,
        saved_payment_method_id: savedPaymentMethodId,
        saved_card_last4: savedCardLast4,
        payment_intent_status: paymentIntent.status,
        is_guest: auctionContext.is_guest,
        guest_bidder_id: auctionContext.guest_bidder_id,
        auto_confirmed: savedPaymentMethodId ? true : false,
      });

      return {
        success: true,
        payment_intent_id: paymentIntent.id,
        metadata: {
          client_secret: paymentIntent.client_secret,
          stripe_customer_id: customerId,
          has_saved_payment_method: hasSavedPaymentMethod,
          saved_card_last4: savedCardLast4,
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
    const webhookReceivedTime = new Date().toISOString();
    console.log('Auction bid pre-authorized (webhook received):', {
      payment_intent_id: paymentIntent.id,
      auction_id: paymentIntent.metadata.auction_id,
      amount: paymentIntent.amount / 100,
      webhook_received_at: webhookReceivedTime,
      payment_intent_created: new Date(paymentIntent.created * 1000).toISOString(),
      processing_delay_ms: Date.now() - (paymentIntent.created * 1000),
    });

    // Save payment method for guest bidders
    if (paymentIntent.metadata.is_guest === 'true' && paymentIntent.metadata.guest_bidder_id) {
      const startTime = Date.now();
      const paymentMethodId = paymentIntent.payment_method as string;
      const customerId = paymentIntent.customer as string;

      console.log('[AuctionStrategy] Processing guest bidder payment method save:', {
        guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
        payment_method_id: paymentMethodId,
        customer_id: customerId,
        has_payment_method: !!paymentMethodId,
        has_customer: !!customerId,
      });

      if (paymentMethodId && customerId) {
        try {
          // CRITICAL FIX FOR EDGE: Explicitly attach payment method to customer
          // This ensures the payment method is saved even if Edge's automatic attachment fails
          const attachStartTime = Date.now();
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
          });
          const attachTime = Date.now() - attachStartTime;

          console.log('[AuctionStrategy] Successfully attached payment method to customer:', {
            payment_method_id: paymentMethodId,
            customer_id: customerId,
            attach_time_ms: attachTime,
            timestamp: new Date().toISOString(),
          });

          // Then save to database
          const saveStartTime = Date.now();
          const guestService = new GuestBidderService();
          await guestService.savePaymentMethod(
            paymentIntent.metadata.guest_bidder_id,
            paymentMethodId
          );
          const saveTime = Date.now() - saveStartTime;

          console.log('[AuctionStrategy] Successfully saved payment method for guest bidder:', {
            guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
            payment_method_id: paymentMethodId,
            customer_id: customerId,
            db_save_time_ms: saveTime,
            total_processing_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          });

          // Verify the save was successful by reading it back
          const verifyStartTime = Date.now();
          const savedMethod = await guestService.getSavedPaymentMethod(paymentIntent.metadata.guest_bidder_id);
          const verifyTime = Date.now() - verifyStartTime;

          if (savedMethod === paymentMethodId) {
            console.log('[AuctionStrategy] ✅ Verified payment method saved correctly:', {
              guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
              verified: true,
              verify_time_ms: verifyTime,
            });
          } else {
            console.error('[AuctionStrategy] ⚠️ Payment method verification failed:', {
              guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
              expected: paymentMethodId,
              actual: savedMethod,
              verify_time_ms: verifyTime,
            });
          }

        } catch (error: any) {
          // If payment method is already attached, that's OK
          if (error.code === 'resource_already_exists') {
            console.log('[AuctionStrategy] Payment method already attached to customer (OK), saving to DB');
            const guestService = new GuestBidderService();
            await guestService.savePaymentMethod(
              paymentIntent.metadata.guest_bidder_id,
              paymentMethodId
            );
            console.log('[AuctionStrategy] Saved pre-attached payment method to database');
          } else {
            console.error('[AuctionStrategy] ❌ Error attaching/saving payment method:', {
              error: error.message,
              error_code: error.code,
              error_type: error.type,
              guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
              payment_method_id: paymentMethodId,
              customer_id: customerId,
              processing_time_ms: Date.now() - startTime,
            });
            throw error;
          }
        }
      } else {
        console.error('[AuctionStrategy] ❌ Missing payment method or customer ID:', {
          payment_method_id: paymentMethodId,
          customer_id: customerId,
          has_payment_method: !!paymentMethodId,
          has_customer: !!customerId,
          guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
        });
      }
    }

    // Update bid status in database for auto-confirmed payments
    if (paymentIntent.metadata.bid_id) {
      const supabase = createServiceRoleClient();

      console.log('[AuctionStrategy] Updating bid status to winning:', {
        bid_id: paymentIntent.metadata.bid_id,
        auction_id: paymentIntent.metadata.auction_id,
      });

      const { data: updatedBid, error: updateError } = await supabase
        .from('bids')
        .update({
          payment_intent_status: 'requires_capture',
          status: 'winning',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentIntent.metadata.bid_id)
        .select()
        .single();

      if (updateError) {
        console.error('[AuctionStrategy] ❌ Error updating bid status:', {
          error: updateError.message,
          bid_id: paymentIntent.metadata.bid_id,
        });
      } else {
        console.log('[AuctionStrategy] ✅ Successfully updated bid status:', {
          bid_id: updatedBid.id,
          status: updatedBid.status,
          payment_intent_status: updatedBid.payment_intent_status,
        });
      }
    } else {
      // CRITICAL WARNING: Missing bid_id in payment intent metadata
      console.error('[AuctionStrategy] ⚠️ CRITICAL: Missing bid_id in payment intent metadata!', {
        payment_intent_id: paymentIntent.id,
        auction_id: paymentIntent.metadata.auction_id,
        customer_id: paymentIntent.customer,
        is_guest: paymentIntent.metadata.is_guest,
        guest_bidder_id: paymentIntent.metadata.guest_bidder_id,
        amount: paymentIntent.amount / 100,
        metadata: paymentIntent.metadata,
        warning: 'Payment was authorized but bid status cannot be updated - bid will not appear in leaderboard!',
      });

      // This is a critical issue - the payment was processed but we can't update the bid
      // The bid will remain in 'pending' status and won't appear in the leaderboard
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Auction payment captured successfully:', {
      payment_intent_id: paymentIntent.id,
      auction_id: paymentIntent.metadata.auction_id,
      amount: paymentIntent.amount / 100,
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
