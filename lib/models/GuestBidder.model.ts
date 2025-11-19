/**
 * Guest Bidder Model
 * Represents guest users who bid without creating an account
 */

export interface GuestBidder {
  id: string;

  // Guest information
  email: string;
  name: string;

  // Stripe integration
  stripe_customer_id?: string;

  // Statistics
  first_bid_at: string;
  total_bids: number;
  total_won: number;
  total_spent: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface CreateGuestBidderDto {
  email: string;
  name: string;
  stripe_customer_id?: string;
}

export interface UpdateGuestBidderDto {
  name?: string;
  stripe_customer_id?: string;
  total_bids?: number;
  total_won?: number;
  total_spent?: number;
}

export interface GuestBidderWithStats extends GuestBidder {
  active_bids: number;
  won_auctions: number;
  win_rate: number;
}

// Helper functions
export function validateEmail(email: string): boolean {
  // Standard email validation (including placeholder emails for WhatsApp)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function validateGuestName(name: string): boolean {
  // At least 2 characters, max 100, letters and spaces only
  const nameRegex = /^[a-zA-Z\s]{2,100}$/;
  return nameRegex.test(name.trim());
}

export function calculateWinRate(totalBids: number, totalWon: number): number {
  if (totalBids === 0) return 0;
  return Math.round((totalWon / totalBids) * 100);
}
