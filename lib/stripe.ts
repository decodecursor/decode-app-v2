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
  private _stripe: Stripe;
  private config: StripeConfig;

  constructor() {
    this.config = {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      environment: process.env.STRIPE_ENVIRONMENT === 'live' ? 'live' : 'test'
    };

    // Only initialize Stripe if we have a secret key (not during build time)
    if (this.config.secretKey) {
      this._stripe = new Stripe(this.config.secretKey, {
        apiVersion: '2025-06-30.basil',
        typescript: true,
      });
    } else {
      // Create a placeholder during build time
      this._stripe = {} as Stripe; 
    }

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.secretKey) {
      console.warn('Missing Stripe secret key. Ensure STRIPE_SECRET_KEY is set.');
    }
    if (!this.config.publishableKey) {
      console.warn('Missing Stripe publishable key. Ensure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set.');
    }
    
    if (this.config.secretKey) {
      console.log(`✅ Stripe configured for ${this.config.environment} environment`);
    }
  }

  public ensureStripeInitialized(): void {
    if (!this.config.secretKey || !this._stripe.paymentIntents) {
      throw new Error('Stripe not properly configured. Missing STRIPE_SECRET_KEY environment variable.');
    }
  }

  // Expose Stripe instance for Connect API calls
  public get stripe(): Stripe {
    return this._stripe;
  }

  /**
   * Create a checkout session for hosted payment page
   */
  async createCheckoutSession(request: PaymentSessionRequest): Promise<PaymentSessionResponse> {
    this.ensureStripeInitialized();
    try {
      const session = await this._stripe.checkout.sessions.create({
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
    this.ensureStripeInitialized();
    try {
      const paymentIntent = await this._stripe.paymentIntents.create({
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
    this.ensureStripeInitialized();
    try {
      return await this._stripe.checkout.sessions.retrieve(sessionId, {
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
    this.ensureStripeInitialized();
    try {
      return await this._stripe.paymentIntents.retrieve(paymentIntentId);
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
      return this._stripe.webhooks.constructEvent(
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
   * Convert AED amount to fils (smallest currency unit)
   * 1 AED = 100 fils
   */
  convertAedToFils(aedAmount: number): number {
    return Math.round(aedAmount * 100); // Convert to fils
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
      this.ensureStripeInitialized();
      // Test API connectivity by retrieving account info
      await this._stripe.accounts.retrieve();
      
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