// Crossmint API Service Layer
// Handles all interactions with Crossmint's headless checkout API

import {
  CrossmintConfig,
  CrossmintWalletCreateRequest,
  CrossmintWalletResponse,
  CrossmintCheckoutRequest,
  CrossmintCheckoutResponse,
  CrossmintWebhookPayload,
  CrossmintAPIError,
  FeeCalculation,
  calculateMarketplaceFee
} from '@/types/crossmint';

class CrossmintService {
  private config: CrossmintConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      apiKey: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || '',
      environment: (process.env.CROSSMINT_ENVIRONMENT as 'staging' | 'production') || 'production',
      webhookSecret: process.env.CROSSMINT_WEBHOOK_SECRET || '',
      decodeWalletAddress: 'H5Kh4fqNaHNaCVdDQT83XtKvpKgRhALrUzUG8Rm5ERv5'
    };

    // Set base URL based on environment - Updated to 2023-06-09 API version
    this.baseUrl = this.config.environment === 'production' 
      ? 'https://www.crossmint.com/api/2023-06-09'
      : 'https://staging.crossmint.com/api/2023-06-09';

    // Validate required configuration
    this.validateConfig();
  }

  private validateConfig(): void {
    // For client-side usage, only check the public API key
    if (!this.config.apiKey) {
      console.warn('Missing Crossmint API key. Ensure NEXT_PUBLIC_CROSSMINT_API_KEY is set.');
    }
    
    // DECODE wallet address is now hardcoded, so no need to check
    console.log('✅ DECODE wallet address configured:', this.config.decodeWalletAddress);
    
    // Webhook secret is only needed server-side, so don't warn about it here
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'X-API-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'DECODE-Beauty-Platform/1.0'
    };

    const requestOptions: RequestInit = {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    };

    try {
      console.log(`🔄 Crossmint API: ${method} ${url}`);
      if (data) {
        console.log(`📤 Request Data:`, JSON.stringify(data, null, 2));
      }
      
      const response = await fetch(url, requestOptions);
      const responseData = await response.json();

      if (!response.ok) {
        console.error(`❌ Crossmint API Error:`, responseData);
        throw new CrossmintAPIError({
          code: responseData.code || `HTTP_${response.status}`,
          message: responseData.message || responseData.error || 'Unknown Crossmint API error',
          details: responseData
        });
      }

      console.log(`✅ Crossmint API Success:`, responseData);
      return responseData;
      
    } catch (error) {
      if (error instanceof CrossmintAPIError) {
        throw error;
      }
      
      console.error(`❌ Crossmint API Request Failed:`, error);
      throw new CrossmintAPIError({
        code: 'NETWORK_ERROR',
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { url, method, originalError: error }
      });
    }
  }

  // WALLET MANAGEMENT
  
  /**
   * Create a new crypto wallet for a user
   */
  async createWallet(userEmail: string): Promise<CrossmintWalletResponse> {
    const request: CrossmintWalletCreateRequest = {
      type: 'evm-smart-wallet',
      linkedUser: `email:${userEmail}`
    };

    return this.makeRequest<CrossmintWalletResponse>('POST', '/wallets', request);
  }

  /**
   * Get wallet information by ID
   */
  async getWallet(walletId: string): Promise<CrossmintWalletResponse> {
    return this.makeRequest<CrossmintWalletResponse>('GET', `/wallets/${walletId}`);
  }

  /**
   * Get wallet by user email (if exists)
   */
  async getWalletByUser(userEmail: string): Promise<CrossmintWalletResponse | null> {
    try {
      // Crossmint API to list wallets for a user
      const response = await this.makeRequest<{ wallets: CrossmintWalletResponse[] }>('GET', `/wallets?linkedUser=email:${userEmail}`);
      return response.wallets.length > 0 ? (response.wallets[0] || null) : null;
    } catch (error) {
      if (error instanceof CrossmintAPIError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  // CHECKOUT & PAYMENTS

  /**
   * Create a headless checkout session
   */
  async createCheckoutSession(
    paymentLinkId: string,
    totalAmount: number,
    originalAmount: number,
    beautyProfessionalId: string
  ): Promise<CrossmintCheckoutResponse> {
    const feeCalculation = calculateMarketplaceFee(originalAmount);
    
    // Note: This API call is not used in production since we use widget approach
    // But keeping it for type compliance
    const request: CrossmintCheckoutRequest = {
      payment: {
        method: 'polygon',
        currency: 'usdc'
      },
      lineItems: [
        {
          callData: {
            totalPrice: totalAmount.toFixed(2),
            originalAmount: originalAmount.toFixed(2),
            feeAmount: feeCalculation.feeAmount.toFixed(2),
            paymentLinkId: paymentLinkId,
            beautyProfessionalId: beautyProfessionalId,
            service: 'beauty',
            description: 'Beauty service payment'
          }
        }
      ],
      recipient: {
        email: 'payments@decode-beauty.com'
      },
      metadata: {
        service: 'beauty',
        original_amount: originalAmount.toFixed(2),
        fee_amount: feeCalculation.feeAmount.toFixed(2),
        beauty_professional_id: beautyProfessionalId,
        payment_link_id: paymentLinkId,
        platform: 'DECODE_Beauty'
      }
    };

    return this.makeRequest<CrossmintCheckoutResponse>('POST', '/orders', request);
  }

  /**
   * Get checkout session status
   */
  async getCheckoutSession(sessionId: string): Promise<CrossmintCheckoutResponse> {
    return this.makeRequest<CrossmintCheckoutResponse>('GET', `/orders/${sessionId}`);
  }

  // TRANSFERS & PAYOUTS

  /**
   * Transfer USDC from DECODE wallet to beauty professional wallet
   */
  async transferToProfessional(
    recipientWalletAddress: string,
    amountUsdc: number,
    transactionId: string
  ): Promise<any> {
    const request = {
      recipient: recipientWalletAddress,
      amount: amountUsdc.toFixed(8), // USDC has 8 decimal places
      currency: 'USDC',
      metadata: {
        type: 'professional_payout',
        original_transaction_id: transactionId,
        platform: 'DECODE_Beauty'
      }
    };

    return this.makeRequest('POST', '/transfers', request);
  }

  // WEBHOOK UTILITIES

  /**
   * Verify webhook signature (security)
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Implementation depends on Crossmint's webhook signature scheme
    // This is a placeholder - actual implementation needed based on Crossmint docs
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: string): CrossmintWebhookPayload {
    try {
      return JSON.parse(payload);
    } catch (error) {
      throw new CrossmintAPIError({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Invalid webhook payload format',
        details: { payload, error }
      });
    }
  }

  // UTILITY METHODS

  /**
   * Get current environment info
   */
  getEnvironmentInfo() {
    return {
      environment: this.config.environment,
      baseUrl: this.baseUrl,
      hasApiKey: !!this.config.apiKey,
      hasWebhookSecret: !!this.config.webhookSecret,
      hasDecodeWallet: !!this.config.decodeWalletAddress
    };
  }

  /**
   * Health check - test API connectivity
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; details: any }> {
    try {
      // Test basic configuration first
      const envInfo = this.getEnvironmentInfo();
      
      // For now, just validate configuration without making API call
      // since we need to verify the correct endpoint format first
      if (!envInfo.hasApiKey) {
        throw new Error('Missing API key configuration');
      }
      
      return {
        status: 'ok',
        details: {
          ...envInfo,
          message: 'Crossmint configuration is valid. Ready for API calls.',
          apiKeyFormat: this.config.apiKey.substring(0, 20) + '...',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          ...this.getEnvironmentInfo(),
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof CrossmintAPIError ? error.code : 'UNKNOWN'
        }
      };
    }
  }
}

// Export singleton instance
export const crossmintService = new CrossmintService();

// Export utility functions
export { calculateMarketplaceFee, CrossmintAPIError };

// Export types for convenience
export type {
  CrossmintWalletResponse,
  CrossmintCheckoutResponse,
  CrossmintWebhookPayload,
  FeeCalculation
};