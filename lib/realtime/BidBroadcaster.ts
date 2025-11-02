/**
 * Bid Broadcaster
 * Handles broadcasting bid events and notifications
 */

import { getAuctionRealtimeManager } from './AuctionRealtimeManager';
import type { Bid } from '@/lib/models/Bid.model';
import type { Auction } from '@/lib/models/Auction.model';

export type BidNotification = {
  type: 'new_highest_bid' | 'outbid' | 'time_extended' | 'auction_ending_soon';
  auction_id: string;
  auction_title: string;
  current_highest_bid?: number;
  bidder_name?: string;
  your_bid_amount?: number;
  time_remaining_ms?: number;
};

export type BidNotificationCallback = (notification: BidNotification) => void;

export class BidBroadcaster {
  private realtimeManager = getAuctionRealtimeManager();
  private notificationCallbacks: Set<BidNotificationCallback> = new Set();
  private lastHighestBids: Map<string, number> = new Map();
  private userBids: Map<string, Set<number>> = new Map(); // auction_id -> Set<bid_amounts>

  /**
   * Start listening to bid events for an auction
   */
  startBroadcasting(
    auctionId: string,
    auction: Auction,
    userEmail?: string
  ): () => void {
    // Subscribe to bid updates
    const unsubscribeBids = this.realtimeManager.subscribeToBids(
      auctionId,
      (event) => {
        if (event.type === 'new_bid') {
          this.handleNewBid(event.bid, auction, userEmail);
        }
      }
    );

    // Subscribe to auction updates (for time extensions)
    const unsubscribeAuction = this.realtimeManager.subscribeToAuction(
      auctionId,
      (event) => {
        if (event.type === 'auction_updated') {
          this.handleAuctionUpdate(event.auction, userEmail);
        }
      }
    );

    // Return cleanup function
    return () => {
      unsubscribeBids();
      unsubscribeAuction();
      this.lastHighestBids.delete(auctionId);
      this.userBids.delete(auctionId);
    };
  }

  /**
   * Register notification callback
   */
  onNotification(callback: BidNotificationCallback): () => void {
    this.notificationCallbacks.add(callback);

    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  /**
   * Track user's bids
   */
  trackUserBid(auctionId: string, amount: number) {
    if (!this.userBids.has(auctionId)) {
      this.userBids.set(auctionId, new Set());
    }
    this.userBids.get(auctionId)!.add(amount);
  }

  /**
   * Handle new bid
   */
  private handleNewBid(bid: Bid, auction: Auction, userEmail?: string) {
    const lastHighest = this.lastHighestBids.get(auction.id) || auction.current_price;
    const newHighest = Number(bid.amount);

    // Update last highest bid
    this.lastHighestBids.set(auction.id, newHighest);

    // Check if user was outbid
    if (userEmail && bid.bidder_email !== userEmail) {
      const userBidAmounts = this.userBids.get(auction.id);
      if (userBidAmounts) {
        // Find user's highest bid
        const userHighest = Math.max(...Array.from(userBidAmounts));

        // If user's highest bid is now lower than new bid, they were outbid
        if (userHighest < newHighest && userHighest === lastHighest) {
          this.notifyCallbacks({
            type: 'outbid',
            auction_id: auction.id,
            auction_title: auction.title,
            current_highest_bid: newHighest,
            bidder_name: bid.bidder_name,
            your_bid_amount: userHighest,
          });
        }
      }
    }

    // Notify about new highest bid (for everyone)
    this.notifyCallbacks({
      type: 'new_highest_bid',
      auction_id: auction.id,
      auction_title: auction.title,
      current_highest_bid: newHighest,
      bidder_name: bid.bidder_name,
    });
  }

  /**
   * Handle auction update (time extensions, etc.)
   */
  private handleAuctionUpdate(auction: Auction, userEmail?: string) {
    const now = new Date().getTime();
    const endTime = new Date(auction.end_time).getTime();
    const timeRemaining = endTime - now;

    // Check for time extension (anti-sniping)
    // If end time just changed and is in the future, it was likely extended
    const previousEndTime = this.getPreviousEndTime(auction.id);
    if (previousEndTime && endTime > previousEndTime) {
      this.notifyCallbacks({
        type: 'time_extended',
        auction_id: auction.id,
        auction_title: auction.title,
        time_remaining_ms: timeRemaining,
      });
    }

    // Notify if auction ending soon (5 minutes)
    if (timeRemaining > 0 && timeRemaining <= 5 * 60 * 1000) {
      // Only notify users who have bid
      if (userEmail && this.userBids.has(auction.id)) {
        this.notifyCallbacks({
          type: 'auction_ending_soon',
          auction_id: auction.id,
          auction_title: auction.title,
          time_remaining_ms: timeRemaining,
        });
      }
    }

    // Store current end time
    this.storeEndTime(auction.id, endTime);
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(notification: BidNotification) {
    this.notificationCallbacks.forEach((callback) => {
      callback(notification);
    });
  }

  /**
   * Store/retrieve end times for comparison
   */
  private endTimes: Map<string, number> = new Map();

  private storeEndTime(auctionId: string, endTime: number) {
    this.endTimes.set(auctionId, endTime);
  }

  private getPreviousEndTime(auctionId: string): number | null {
    return this.endTimes.get(auctionId) || null;
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.notificationCallbacks.clear();
    this.lastHighestBids.clear();
    this.userBids.clear();
    this.endTimes.clear();
  }
}

// Singleton instance
let bidBroadcasterInstance: BidBroadcaster | null = null;

export function getBidBroadcaster(): BidBroadcaster {
  if (!bidBroadcasterInstance) {
    bidBroadcasterInstance = new BidBroadcaster();
  }
  return bidBroadcasterInstance;
}
