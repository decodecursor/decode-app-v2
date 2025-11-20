/**
 * Auction Model
 * Represents a live auction created by MODEL users
 */

export type AuctionStatus = 'pending' | 'active' | 'ended' | 'completed' | 'cancelled';
export type PayoutStatus = 'pending' | 'processing' | 'transferred' | 'failed';
export type AuctionDuration = 5 | 30 | 60 | 180 | 1440; // minutes

export interface Auction {
  id: string;

  // Auction ownership
  creator_id: string;

  // Auction details
  title: string;
  description?: string;

  // Pricing
  auction_start_price: number;
  auction_current_price: number;
  auction_buy_now_price?: number;

  // Timing
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  duration: AuctionDuration;

  // Status
  status: AuctionStatus;

  // Winner information
  winner_bid_id?: string;
  winner_name?: string;
  winner_email?: string;
  winner_instagram_username?: string;

  // Payment tracking
  payment_captured_at?: string;
  payout_status: PayoutStatus;

  // Metadata
  total_bids: number;
  unique_bidders: number;

  // EventBridge Scheduler
  scheduler_event_id?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateAuctionDto {
  creator_id: string;
  title: string;
  description?: string;
  auction_start_price: number;
  auction_buy_now_price?: number;
  duration: AuctionDuration;
  start_time?: string; // Optional, defaults to NOW
}

export interface UpdateAuctionDto {
  title?: string;
  description?: string;
  status?: AuctionStatus;
  winner_bid_id?: string;
  winner_name?: string;
  winner_email?: string;
  winner_instagram_username?: string;
  payment_captured_at?: string;
  payout_status?: PayoutStatus;
  scheduler_event_id?: string;
}

export interface AuctionWithCreator extends Auction {
  creator: {
    id: string;
    email: string;
    user_name?: string;
    role: string;
    profile_photo_url?: string;
  };
}

export interface AuctionListItem {
  id: string;
  title: string;
  description?: string;
  auction_start_price: number;
  auction_current_price: number;
  status: AuctionStatus;
  end_time: string;
  total_bids: number;
  creator_name?: string;
  time_remaining_ms?: number;
}

// Helper functions
export const AUCTION_DURATIONS: { value: AuctionDuration; label: string }[] = [
  { value: 5, label: '5 Minutes' },
  { value: 30, label: '30 Minutes' },
  { value: 60, label: '1 Hour' },
  { value: 180, label: '3 Hours' },
  { value: 1440, label: '24 Hours' },
];

export function getAuctionEndTime(startTime: Date, duration: AuctionDuration): Date {
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + duration);
  return endTime;
}

export function isAuctionActive(auction: Auction): boolean {
  return auction.status === 'active' && new Date(auction.end_time) > new Date();
}

export function isAuctionEnded(auction: Auction): boolean {
  return auction.status === 'ended' || new Date(auction.end_time) <= new Date();
}

export function getTimeRemaining(endTime: string): number {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  return Math.max(0, end - now);
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Ended';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
