/**
 * Bid Model
 * Represents a bid placed on an auction with Stripe pre-authorization
 */

export type BidStatus = 'pending' | 'winning' | 'outbid' | 'captured' | 'cancelled' | 'failed';
export type PaymentIntentStatus = 'requires_capture' | 'captured' | 'cancelled' | 'failed';

export interface Bid {
  id: string;

  // Auction reference
  auction_id: string;

  // Bidder information (for leaderboard display)
  bidder_email: string;
  bidder_name: string;

  // User or guest
  is_guest: boolean;
  user_id?: string;
  guest_bidder_id?: string;

  // Bid details
  amount: number;

  // Stripe pre-authorization
  payment_intent_id: string;
  payment_intent_status: PaymentIntentStatus;

  // Bid status
  status: BidStatus;

  // Security
  ip_address?: string;
  user_agent?: string;

  // Timestamps
  placed_at: string;
  updated_at: string;
}

export interface CreateBidDto {
  auction_id: string;
  bidder_email: string;
  bidder_name: string;
  amount: number;
  is_guest: boolean;
  user_id?: string;
  guest_bidder_id?: string;
  payment_intent_id: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UpdateBidDto {
  status?: BidStatus;
  payment_intent_status?: PaymentIntentStatus;
}

export interface BidWithAuction extends Bid {
  auction: {
    id: string;
    title: string;
    status: string;
    end_time: string;
  };
}

export interface LeaderboardEntry {
  id: string;
  bidder_name: string;
  amount: number;
  placed_at: string;
  is_current_user: boolean;
  rank: number;
}

export interface BidStatistics {
  total_bids: number;
  highest_bid: number;
  lowest_bid: number;
  average_bid: number;
  unique_bidders: number;
}

// Helper functions
export function calculateMinimumBid(currentPrice: number, startPrice: number): number {
  // Percentage-based minimum increment that scales with current bid
  if (currentPrice === 0) {
    return startPrice;
  }

  // 5% increment for bids under $100
  if (currentPrice < 100) {
    return Math.ceil(currentPrice * 1.05);
  }

  // 3% increment for bids $100-$500
  if (currentPrice < 500) {
    return Math.ceil(currentPrice * 1.03);
  }

  // 2% increment for bids over $500
  return Math.ceil(currentPrice * 1.02);
}

export function formatBidAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AED',
  }).format(amount);
}

export function getBidStatusColor(status: BidStatus): string {
  switch (status) {
    case 'winning':
      return 'green';
    case 'outbid':
      return 'yellow';
    case 'captured':
      return 'blue';
    case 'cancelled':
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
}

export function getBidStatusLabel(status: BidStatus): string {
  switch (status) {
    case 'winning':
      return 'Winning';
    case 'outbid':
      return 'Outbid';
    case 'captured':
      return 'Won';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

export function sanitizeBidderName(name: string): string {
  // Basic sanitization for display
  return name.trim().slice(0, 100);
}

export function formatBidderNameForLeaderboard(name: string, hideLastName = true): string {
  if (!hideLastName) {
    return name;
  }

  // Show first name and last initial (e.g., "John D.")
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}
