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
  gross_amount: number;
  platform_fee: number;
  platform_fee_percentage: number;
  net_amount: number;

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
  gross_amount: number;
  platform_fee_percentage: number;
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
export const DEFAULT_AUCTION_FEE_PERCENTAGE = 10; // 10% platform fee

// Helper functions
export function calculatePlatformFee(
  grossAmount: number,
  feePercentage: number = DEFAULT_AUCTION_FEE_PERCENTAGE
): number {
  return Math.round((grossAmount * feePercentage) / 100 * 100) / 100;
}

export function calculateNetAmount(grossAmount: number, platformFee: number): number {
  return Math.round((grossAmount - platformFee) * 100) / 100;
}

export function createPayoutFromAuction(
  modelId: string,
  auctionId: string,
  winningBidAmount: number,
  feePercentage: number = DEFAULT_AUCTION_FEE_PERCENTAGE
): CreateAuctionPayoutDto {
  return {
    model_id: modelId,
    auction_id: auctionId,
    gross_amount: winningBidAmount,
    platform_fee_percentage: feePercentage,
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
      total_gross: summary.total_gross + payout.gross_amount,
      total_fees: summary.total_fees + payout.platform_fee,
      total_net: summary.total_net + payout.net_amount,
      pending_count:
        summary.pending_count + (payout.status === 'pending' ? 1 : 0),
      pending_amount:
        summary.pending_amount +
        (payout.status === 'pending' ? payout.net_amount : 0),
      transferred_count:
        summary.transferred_count + (payout.status === 'transferred' ? 1 : 0),
      transferred_amount:
        summary.transferred_amount +
        (payout.status === 'transferred' ? payout.net_amount : 0),
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
