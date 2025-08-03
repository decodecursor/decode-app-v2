// TypeScript types for Crossmint integration

export interface CrossmintUser {
  id: string;
  email: string;
  full_name: string;
  professional_center_name: string | null;
  instagram_handle: string | null;
  wallet_address: string | null;
  crossmint_wallet_id: string | null;
  wallet_created_at: string | null;
  role: string;
  created_at: string;
}

export interface CrossmintPaymentLink {
  id: string; // UUID primary key
  short_id?: string; // 8-character public ID for URLs
  client_name: string | null;
  title: string;
  description: string | null;
  // Original amount fields
  amount_aed: number; // Legacy field, kept for compatibility
  service_amount_aed?: number; // New: pure service amount
  decode_amount_aed?: number; // New: decode platform amount (9%)
  total_amount_aed?: number; // New: total customer pays
  amount_usd?: number; // USD equivalent for international payments
  expiration_date: string;
  creator_id: string;
  linked_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  payment_link_id?: string;
  transaction_type: 
    | 'payment_received'  // Customer paid for service
    | 'transfer_out'      // Money transferred to beauty professional
    | 'fee_collected'     // DECODE marketplace fee
    | 'refund_issued'     // Refund processed
    | 'wallet_created';   // Initial wallet creation
  amount_usdc?: number;
  amount_aed?: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  crossmint_transaction_id?: string;
  crossmint_session_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface UserTransactionSummary {
  user_id: string;
  email: string;
  full_name: string;
  total_transactions: number;
  total_received_usdc: number;
  total_transferred_usdc: number;
  total_fees_usdc: number;
  last_transaction_at: string;
}

// Crossmint API Types
export interface CrossmintWalletCreateRequest {
  type: 'evm-smart-wallet';
  config?: {
    adminSigner?: {
      type: 'evm-keypair';
      address: string;
    };
  };
  linkedUser: string; // email:user@example.com format
}

export interface CrossmintWalletResponse {
  id: string;
  address: string;
  type: string;
  config: Record<string, any>;
  linkedUser: string;
}

export interface CrossmintCheckoutRequest {
  payment: {
    method: string; // blockchain network e.g., 'polygon-amoy', 'ethereum', 'solana'
    currency: 'usdc' | 'eth' | 'matic' | 'sol'; // Crypto currencies
    payerAddress?: string; // Optional wallet address
  };
  lineItems: Array<{
    productLocator?: string;
    callData: {
      totalPrice?: string;
      originalAmount?: string;
      feeAmount?: string;
      paymentLinkId?: string;
      beautyProfessionalId?: string;
      service?: string;
      description?: string;
      [key: string]: any;
    };
  }>;
  recipient: {
    email?: string;
    walletAddress?: string;
  };
  metadata?: {
    service?: string;
    original_amount?: string;
    fee_amount?: string;
    beauty_professional_id?: string;
    payment_link_id?: string;
    platform?: string;
    [key: string]: any;
  };
}

export interface CrossmintCheckoutResponse {
  id: string;
  url: string;
  status: string;
  amount: string;
  currency: string;
  metadata: Record<string, any>;
}

export interface CrossmintWebhookPayload {
  event: 
    | 'payment.completed'
    | 'payment.failed'
    | 'transfer.completed'
    | 'transfer.failed';
  data: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    recipient: string;
    metadata: Record<string, any>;
    created_at: string;
    completed_at?: string;
  };
}

// Fee calculation utilities
export interface FeeCalculation {
  originalAmount: number;
  feePercentage: number; // 9
  feeAmount: number;
  totalAmount: number;
}

export function calculateMarketplaceFee(originalAmount: number): FeeCalculation {
  const feePercentage = 9;
  const feeAmount = Math.round(originalAmount * (feePercentage / 100) * 100) / 100;
  const totalAmount = Math.round((originalAmount + feeAmount) * 100) / 100;
  
  return {
    originalAmount,
    feePercentage,
    feeAmount,
    totalAmount
  };
}

// Payment link creation with fee calculation
export interface CreatePaymentLinkRequest {
  client_name?: string;
  title: string;
  description?: string;
  original_amount_aed: number; // The service amount (what professional receives)
  creator_id: string;
  linked_user_id?: string;
}

export interface CreatePaymentLinkResponse extends CrossmintPaymentLink {
  fee_calculation: FeeCalculation;
}

// Dashboard transaction display
export interface DashboardTransaction {
  id: string;
  type: WalletTransaction['transaction_type'];
  amount_display: string; // Formatted amount with currency
  status: WalletTransaction['status'];
  payment_link_title?: string;
  client_name?: string;
  created_at: string;
  completed_at?: string;
}

// Environment configuration
export interface CrossmintConfig {
  apiKey: string;
  environment: 'staging' | 'production';
  webhookSecret: string;
  decodeWalletAddress: string;
}

// Error types
export interface CrossmintError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class CrossmintAPIError extends Error {
  public code: string;
  public details?: Record<string, any>;

  constructor(error: CrossmintError) {
    super(error.message);
    this.name = 'CrossmintAPIError';
    this.code = error.code;
    this.details = error.details;
  }
}