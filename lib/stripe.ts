// Stripe API Service Layer
// Handles all interactions with Stripe's payment processing API

import Stripe from 'stripe';

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  environment: 'test' | 'live';
}

export interface PaymentSessionRequest {
  amount: number; // in cents (USD)
  currency: string;
  paymentLinkId: string;
  beautyProfessionalId: string;
  customerEmail?: string;
  customerName?: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentSessionResponse {
  sessionId: string;
  clientSecret: string;
  publicKey: string;
  url?: string;
}

class StripeService {
  private stripe: Stripe;
  private config: StripeConfig;

  constructor() {
    this.config = {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      environment: process.env.STRIPE_ENVIRONMENT === 'live' ? 'live' : 'test'
    };

    // Initialize Stripe with secret key
    this.stripe = new Stripe(this.config.secretKey, {
      apiVersion: '2025-06-30.basil',
      typescript: true,
    });

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.secretKey) {
      console.warn('Missing Stripe secret key. Ensure STRIPE_SECRET_KEY is set.');
    }
    if (!this.config.publishableKey) {
      console.warn('Missing Stripe publishable key. Ensure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set.');
    }
    
    console.log(`✅ Stripe configured for ${this.config.environment} environment`);
  }

  /**
   * Create a checkout session for hosted payment page
   */
  async createCheckoutSession(request: PaymentSessionRequest): Promise<PaymentSessionResponse> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card', 'link'],
        line_items: [
          {
            price_data: {
              currency: request.currency.toLowerCase(),
              product_data: {
                name: 'Beauty Service Payment',
                description: request.description,
              },
              unit_amount: request.amount, // Amount in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        customer_email: request.customerEmail,
        metadata: {
          payment_link_id: request.paymentLinkId,
          beauty_professional_id: request.beautyProfessionalId,
          original_amount: (request.amount / 100).toString(),
          currency: request.currency,
          platform: 'DECODE_Beauty'
        },
        payment_intent_data: {
          metadata: {
            payment_link_id: request.paymentLinkId,
            beauty_professional_id: request.beautyProfessionalId,
            platform: 'DECODE_Beauty'
          }
        }
      });

      return {
        sessionId: session.id,
        clientSecret: session.client_secret || '',
        publicKey: this.config.publishableKey,
        url: session.url || undefined
      };
    } catch (error) {
      console.error('Stripe checkout session creation failed:', error);
      throw new Error(`Failed to create payment session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a payment intent for custom payment flow
   */
  async createPaymentIntent(request: Omit<PaymentSessionRequest, 'successUrl' | 'cancelUrl'>): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        description: request.description,
        metadata: {
          payment_link_id: request.paymentLinkId,
          beauty_professional_id: request.beautyProfessionalId,
          original_amount: (request.amount / 100).toString(),
          currency: request.currency,
          platform: 'DECODE_Beauty'
        }
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error('Stripe payment intent creation failed:', error);
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      });
    } catch (error) {
      console.error('Failed to retrieve checkout session:', error);
      throw new Error(`Failed to retrieve session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Failed to retrieve payment intent:', error);
      throw new Error(`Failed to retrieve payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify webhook signature for security
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert AED to USD for Stripe processing
   * Using approximate conversion rate - in production, use real-time rates
   */
  convertAedToUsd(aedAmount: number): number {
    const USD_TO_AED_RATE = 3.67; // Approximate rate, use real-time in production
    return Math.round((aedAmount / USD_TO_AED_RATE) * 100); // Convert to cents
  }

  /**
   * Calculate platform fee (same as Crossmint implementation)
   */
  calculatePlatformFee(amount: number): { netAmount: number; feeAmount: number; totalAmount: number } {
    const feePercentage = 0.05; // 5% platform fee
    const feeAmount = Math.round(amount * feePercentage);
    const netAmount = amount - feeAmount;
    
    return {
      netAmount,
      feeAmount,
      totalAmount: amount
    };
  }

  /**
   * Get environment info for debugging
   */
  getEnvironmentInfo() {
    return {
      environment: this.config.environment,
      hasSecretKey: !!this.config.secretKey,
      hasPublishableKey: !!this.config.publishableKey,
      hasWebhookSecret: !!this.config.webhookSecret,
      publishableKeyPrefix: this.config.publishableKey.substring(0, 20) + '...'
    };
  }

  /**
   * Health check for Stripe configuration
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; details: any }> {
    try {
      // Test API connectivity by retrieving account info
      await this.stripe.accounts.retrieve();
      
      return {
        status: 'ok',
        details: {
          ...this.getEnvironmentInfo(),
          message: 'Stripe configuration is valid and API is accessible',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          ...this.getEnvironmentInfo(),
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();

// Export Stripe types for convenience
export type {
  Stripe
};