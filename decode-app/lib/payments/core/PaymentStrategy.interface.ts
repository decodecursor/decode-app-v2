/**
 * Payment Strategy Interface
 * Base interface for all payment strategies (STAFF, ADMIN, MODEL auctions)
 */

export interface PaymentResult {
  success: boolean;
  payment_intent_id?: string;
  checkout_session_id?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  amount_refunded?: number;
  error?: string;
}

export interface PaymentContext {
  user_id: string;
  user_role: 'Admin' | 'Staff' | 'Model';
  amount: number;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Base Payment Strategy Interface
 * All payment strategies must implement these methods
 */
export interface IPaymentStrategy {
  /**
   * Get the strategy name
   */
  getName(): string;

  /**
   * Validate if this strategy can handle the payment
   */
  canHandle(context: PaymentContext): boolean;

  /**
   * Create a payment (checkout session or payment intent)
   */
  createPayment(context: PaymentContext): Promise<PaymentResult>;

  /**
   * Process a payment webhook event
   */
  handleWebhook(event: any): Promise<void>;

  /**
   * Refund a payment
   */
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;

  /**
   * Get payment details
   */
  getPaymentDetails(paymentId: string): Promise<any>;
}

/**
 * Strategy-specific configuration
 */
export interface StrategyConfig {
  enabled: boolean;
  settings: Record<string, any>;
}
