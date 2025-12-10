/**
 * Payment Service
 * Central service that routes payments to appropriate strategies
 */

import { IPaymentStrategy, PaymentContext, PaymentResult, RefundResult } from './PaymentStrategy.interface';

export class PaymentService {
  private strategies: Map<string, IPaymentStrategy> = new Map();

  /**
   * Register a payment strategy
   */
  registerStrategy(strategy: IPaymentStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
  }

  /**
   * Get a strategy by name
   */
  getStrategy(name: string): IPaymentStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Find the appropriate strategy for a payment context
   */
  private findStrategy(context: PaymentContext): IPaymentStrategy | null {
    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(context)) {
        return strategy;
      }
    }
    return null;
  }

  /**
   * Create a payment using the appropriate strategy
   */
  async createPayment(context: PaymentContext): Promise<PaymentResult> {
    const strategy = this.findStrategy(context);

    if (!strategy) {
      return {
        success: false,
        error: 'No payment strategy available for this context',
      };
    }

    try {
      return await strategy.createPayment(context);
    } catch (error) {
      console.error('Payment creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment creation failed',
      };
    }
  }

  /**
   * Process a webhook event
   * Routes to all strategies to handle their respective events
   */
  async handleWebhook(event: any): Promise<void> {
    const promises = Array.from(this.strategies.values()).map((strategy) =>
      strategy.handleWebhook(event).catch((error) => {
        console.error(`Webhook handling error in ${strategy.getName()}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    strategyName: string,
    paymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    const strategy = this.getStrategy(strategyName);

    if (!strategy) {
      return {
        success: false,
        error: `Strategy '${strategyName}' not found`,
      };
    }

    try {
      return await strategy.refundPayment(paymentId, amount);
    } catch (error) {
      console.error('Refund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(strategyName: string, paymentId: string): Promise<any> {
    const strategy = this.getStrategy(strategyName);

    if (!strategy) {
      throw new Error(`Strategy '${strategyName}' not found`);
    }

    return await strategy.getPaymentDetails(paymentId);
  }

  /**
   * List all registered strategies
   */
  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// Singleton instance
let paymentServiceInstance: PaymentService | null = null;

export function getPaymentService(): PaymentService {
  if (!paymentServiceInstance) {
    paymentServiceInstance = new PaymentService();
  }
  return paymentServiceInstance;
}
