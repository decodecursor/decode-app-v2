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
  // Fixed AED increment based on current bid amount
  if (currentPrice === 0) {
    return startPrice;
  }

  // 5 AED increment for bids 5-999
  if (currentPrice < 1000) {
    return currentPrice + 5;
  }

  // 10 AED increment for bids 1,000-2,499
  if (currentPrice < 2500) {
    return currentPrice + 10;
  }

  // 25 AED increment for bids 2,500-4,999
  if (currentPrice < 5000) {
    return currentPrice + 25;
  }

  // 50 AED increment for bids 5,000-9,999
  if (currentPrice < 10000) {
    return currentPrice + 50;
  }

  // 100 AED increment for bids 10,000+
  return currentPrice + 100;
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
