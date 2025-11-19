/**
 * Auction Payout Model
 * Represents payout tracking for MODEL user earnings from auctions
 */

export type PayoutStatus = 'pending' | 'processing' | 'transferred' | 'failed' | 'cancelled';
export type TransferMethod = 'bank_transfer' | 'paypal' | 'stripe_connect';

export interface AuctionPayout {
  id: string;

  // References
  model_id: string;
  auction_id: string;

  // Payment amounts
  auction_winning_amount: number;
  auction_profit_amount: number;
  auction_profit_decode_amount: number;
  auction_profit_decode_percentage: number;
  auction_profit_model_amount: number;

  // Payout status
  status: PayoutStatus;

  // Transfer details
  transfer_method?: TransferMethod;
  transferred_at?: string;
  transfer_reference?: string;

  // Metadata
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateAuctionPayoutDto {
  model_id: string;
  auction_id: string;
  auction_winning_amount: number;
  auction_start_price: number;
  auction_profit_decode_percentage: number;
}

export interface UpdateAuctionPayoutDto {
  status?: PayoutStatus;
  transfer_method?: TransferMethod;
  transferred_at?: string;
  transfer_reference?: string;
  notes?: string;
}

export interface AuctionPayoutWithDetails extends AuctionPayout {
  model: {
    id: string;
    email: string;
    full_name?: string;
  };
  auction: {
    id: string;
    title: string;
    winner_name?: string;
  };
}

export interface PayoutSummary {
  total_payouts: number;
  total_gross: number;
  total_fees: number;
  total_net: number;
  pending_count: number;
  pending_amount: number;
  transferred_count: number;
  transferred_amount: number;
}

// Default platform fee percentage for auctions
export const DEFAULT_AUCTION_FEE_PERCENTAGE = 25; // 25% platform fee on profit

// Helper functions for profit-based fee calculation
export function calculateProfit(
  winningAmount: number,
  startPrice: number
): number {
  const profit = winningAmount - startPrice;
  return Math.max(0, Math.round(profit * 100) / 100);
}

export function calculatePlatformFee(
  winningAmount: number,
  startPrice: number,
  feePercentage: number = DEFAULT_AUCTION_FEE_PERCENTAGE
): number {
  const profit = calculateProfit(winningAmount, startPrice);
  if (profit <= 0) return 0; // No profit, no fee
  return Math.round((profit * feePercentage) / 100 * 100) / 100;
}

export function calculateModelAmount(
  winningAmount: number,
  platformFee: number
): number {
  return Math.round((winningAmount - platformFee) * 100) / 100;
}

export function createPayoutFromAuction(
  modelId: string,
  auctionId: string,
  winningBidAmount: number,
  startPrice: number,
  feePercentage: number = DEFAULT_AUCTION_FEE_PERCENTAGE
): CreateAuctionPayoutDto {
  return {
    model_id: modelId,
    auction_id: auctionId,
    auction_winning_amount: winningBidAmount,
    auction_start_price: startPrice,
    auction_profit_decode_percentage: feePercentage,
  };
}

export function getPayoutStatusColor(status: PayoutStatus): string {
  switch (status) {
    case 'transferred':
      return 'green';
    case 'processing':
      return 'blue';
    case 'pending':
      return 'yellow';
    case 'failed':
    case 'cancelled':
      return 'red';
    default:
      return 'gray';
  }
}

export function getPayoutStatusLabel(status: PayoutStatus): string {
  switch (status) {
    case 'transferred':
      return 'Transferred';
    case 'processing':
      return 'Processing';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

export function formatPayoutAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculatePayoutSummary(payouts: AuctionPayout[]): PayoutSummary {
  return payouts.reduce(
    (summary, payout) => ({
      total_payouts: summary.total_payouts + 1,
      total_gross: summary.total_gross + payout.auction_winning_amount,
      total_fees: summary.total_fees + payout.auction_profit_decode_amount,
      total_net: summary.total_net + payout.auction_profit_model_amount,
      pending_count:
        summary.pending_count + (payout.status === 'pending' ? 1 : 0),
      pending_amount:
        summary.pending_amount +
        (payout.status === 'pending' ? payout.auction_profit_model_amount : 0),
      transferred_count:
        summary.transferred_count + (payout.status === 'transferred' ? 1 : 0),
      transferred_amount:
        summary.transferred_amount +
        (payout.status === 'transferred' ? payout.auction_profit_model_amount : 0),
    }),
    {
      total_payouts: 0,
      total_gross: 0,
      total_fees: 0,
      total_net: 0,
      pending_count: 0,
      pending_amount: 0,
      transferred_count: 0,
      transferred_amount: 0,
    }
  );
}
