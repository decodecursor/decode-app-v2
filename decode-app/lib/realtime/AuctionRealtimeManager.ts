/**
 * Auction Realtime Manager
 * Manages Supabase Realtime subscriptions for auctions and bids
 */

import { createClient } from '@/utils/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Auction } from '@/lib/models/Auction.model';
import type { Bid } from '@/lib/models/Bid.model';

export type AuctionEvent = {
  type: 'auction_updated' | 'auction_ended' | 'auction_started' | 'auction_cancelled';
  auction: Auction;
};

export type BidEvent = {
  type: 'new_bid' | 'bid_updated';
  bid: Bid;
  auction_id: string;
};

export type AuctionEventCallback = (event: AuctionEvent) => void;
export type BidEventCallback = (event: BidEvent) => void;

export class AuctionRealtimeManager {
  private supabase = createClient();
  private channels: Map<string, RealtimeChannel> = new Map();
  private auctionCallbacks: Map<string, Set<AuctionEventCallback>> = new Map();
  private bidCallbacks: Map<string, Set<BidEventCallback>> = new Map();

  /**
   * Subscribe to auction updates
   */
  subscribeToAuction(
    auctionId: string,
    callback: AuctionEventCallback
  ): () => void {
    const channelName = `auction:${auctionId}`;

    // Add callback to set
    if (!this.auctionCallbacks.has(channelName)) {
      this.auctionCallbacks.set(channelName, new Set());
    }
    this.auctionCallbacks.get(channelName)!.add(callback);

    // Create channel if it doesn't exist
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auctions',
            filter: `id=eq.${auctionId}`,
          },
          (payload) => {
            this.handleAuctionChange(payload, auctionId);
          }
        )
        .subscribe((status) => {
          console.log(`Auction channel ${channelName} status:`, status);
        });

      this.channels.set(channelName, channel);
    }

    // Return unsubscribe function
    return () => {
      this.auctionCallbacks.get(channelName)?.delete(callback);

      // Remove channel if no more callbacks
      if (this.auctionCallbacks.get(channelName)?.size === 0) {
        this.channels.get(channelName)?.unsubscribe();
        this.channels.delete(channelName);
        this.auctionCallbacks.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to bid updates for an auction
   */
  subscribeToBids(
    auctionId: string,
    callback: BidEventCallback
  ): () => void {
    const channelName = `bids:${auctionId}`;

    // Add callback to set
    if (!this.bidCallbacks.has(channelName)) {
      this.bidCallbacks.set(channelName, new Set());
    }
    this.bidCallbacks.get(channelName)!.add(callback);

    // Create channel if it doesn't exist
    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bids',
            filter: `auction_id=eq.${auctionId}`,
          },
          (payload) => {
            this.handleBidInsert(payload, auctionId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bids',
            filter: `auction_id=eq.${auctionId}`,
          },
          (payload) => {
            this.handleBidUpdate(payload, auctionId);
          }
        )
        .subscribe((status) => {
          console.log(`Bids channel ${channelName} status:`, status);
        });

      this.channels.set(channelName, channel);
    }

    // Return unsubscribe function
    return () => {
      this.bidCallbacks.get(channelName)?.delete(callback);

      // Remove channel if no more callbacks
      if (this.bidCallbacks.get(channelName)?.size === 0) {
        this.channels.get(channelName)?.unsubscribe();
        this.channels.delete(channelName);
        this.bidCallbacks.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to all active auctions
   */
  subscribeToActiveAuctions(callback: AuctionEventCallback): () => void {
    const channelName = 'auctions:active';

    if (!this.auctionCallbacks.has(channelName)) {
      this.auctionCallbacks.set(channelName, new Set());
    }
    this.auctionCallbacks.get(channelName)!.add(callback);

    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auctions',
            filter: 'status=eq.active',
          },
          (payload) => {
            this.handleAuctionChange(payload, null);
          }
        )
        .subscribe((status) => {
          console.log(`Active auctions channel status:`, status);
        });

      this.channels.set(channelName, channel);
    }

    return () => {
      this.auctionCallbacks.get(channelName)?.delete(callback);

      if (this.auctionCallbacks.get(channelName)?.size === 0) {
        this.channels.get(channelName)?.unsubscribe();
        this.channels.delete(channelName);
        this.auctionCallbacks.delete(channelName);
      }
    };
  }

  /**
   * Subscribe to creator's auctions
   */
  subscribeToCreatorAuctions(creatorId: string, callback: AuctionEventCallback): () => void {
    const channelName = `creator:${creatorId}`;

    if (!this.auctionCallbacks.has(channelName)) {
      this.auctionCallbacks.set(channelName, new Set());
    }
    this.auctionCallbacks.get(channelName)!.add(callback);

    if (!this.channels.has(channelName)) {
      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auctions',
            filter: `creator_id=eq.${creatorId}`,
          },
          (payload) => {
            this.handleCreatorAuctionChange(payload, creatorId);
          }
        )
        .subscribe((status) => {
          console.log(`Creator auctions channel ${channelName} status:`, status);
        });

      this.channels.set(channelName, channel);
    }

    return () => {
      this.auctionCallbacks.get(channelName)?.delete(callback);

      if (this.auctionCallbacks.get(channelName)?.size === 0) {
        this.channels.get(channelName)?.unsubscribe();
        this.channels.delete(channelName);
        this.auctionCallbacks.delete(channelName);
      }
    };
  }

  /**
   * Handle auction changes
   */
  private handleAuctionChange(payload: any, auctionId: string | null) {
    const auction = payload.new as Auction;
    const oldAuction = payload.old as Auction | null;

    let eventType: AuctionEvent['type'] = 'auction_updated';

    // Determine event type
    if (payload.eventType === 'INSERT') {
      eventType = 'auction_started';
    } else if (auction.status === 'cancelled') {
      eventType = 'auction_cancelled';
    } else if (
      oldAuction?.status === 'active' &&
      (auction.status === 'ended' || auction.status === 'completed')
    ) {
      eventType = 'auction_ended';
    } else if (oldAuction?.status === 'pending' && auction.status === 'active') {
      eventType = 'auction_started';
    }

    const event: AuctionEvent = {
      type: eventType,
      auction,
    };

    // Notify specific auction callbacks
    if (auctionId) {
      const channelName = `auction:${auctionId}`;
      this.auctionCallbacks.get(channelName)?.forEach((callback) => {
        callback(event);
      });
    }

    // Notify active auctions callbacks
    const activeChannelName = 'auctions:active';
    this.auctionCallbacks.get(activeChannelName)?.forEach((callback) => {
      callback(event);
    });
  }

  /**
   * Handle creator auction changes
   */
  private handleCreatorAuctionChange(payload: any, creatorId: string) {
    const auction = payload.new as Auction;
    const oldAuction = payload.old as Auction | null;

    let eventType: AuctionEvent['type'] = 'auction_updated';

    // Determine event type
    if (payload.eventType === 'INSERT') {
      eventType = 'auction_started';
    } else if (auction.status === 'cancelled') {
      eventType = 'auction_cancelled';
    } else if (
      oldAuction?.status === 'active' &&
      (auction.status === 'ended' || auction.status === 'completed')
    ) {
      eventType = 'auction_ended';
    } else if (oldAuction?.status === 'pending' && auction.status === 'active') {
      eventType = 'auction_started';
    }

    const event: AuctionEvent = {
      type: eventType,
      auction,
    };

    // Notify creator auctions callbacks
    const channelName = `creator:${creatorId}`;
    this.auctionCallbacks.get(channelName)?.forEach((callback) => {
      callback(event);
    });
  }

  /**
   * Handle new bid
   */
  private handleBidInsert(payload: any, auctionId: string) {
    const bid = payload.new as Bid;

    const event: BidEvent = {
      type: 'new_bid',
      bid,
      auction_id: auctionId,
    };

    const channelName = `bids:${auctionId}`;
    this.bidCallbacks.get(channelName)?.forEach((callback) => {
      callback(event);
    });
  }

  /**
   * Handle bid update
   */
  private handleBidUpdate(payload: any, auctionId: string) {
    const bid = payload.new as Bid;

    const event: BidEvent = {
      type: 'bid_updated',
      bid,
      auction_id: auctionId,
    };

    const channelName = `bids:${auctionId}`;
    this.bidCallbacks.get(channelName)?.forEach((callback) => {
      callback(event);
    });
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
    this.auctionCallbacks.clear();
    this.bidCallbacks.clear();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(channelName: string): string {
    const channel = this.channels.get(channelName);
    return channel?.state || 'disconnected';
  }

  /**
   * Force reconnect all active channels
   * Critical for mobile: when page returns from background, WebSocket may be stale
   */
  async reconnectAll(): Promise<void> {
    console.log('Reconnecting all realtime channels...');

    const reconnectPromises: Promise<void>[] = [];

    this.channels.forEach((channel, channelName) => {
      const promise = new Promise<void>((resolve) => {
        // Unsubscribe and resubscribe
        channel.unsubscribe();

        // Small delay to ensure clean disconnect
        setTimeout(() => {
          // Resubscribe with same configuration
          if (channelName.startsWith('auction:') && !channelName.includes('active')) {
            const auctionId = channelName.replace('auction:', '');
            const callbacks = this.auctionCallbacks.get(channelName);

            if (callbacks && callbacks.size > 0) {
              const newChannel = this.supabase
                .channel(channelName)
                .on(
                  'postgres_changes',
                  {
                    event: '*',
                    schema: 'public',
                    table: 'auctions',
                    filter: `id=eq.${auctionId}`,
                  },
                  (payload) => {
                    this.handleAuctionChange(payload, auctionId);
                  }
                )
                .subscribe((status) => {
                  console.log(`Reconnected auction channel ${channelName}:`, status);
                  resolve();
                });

              this.channels.set(channelName, newChannel);
            } else {
              resolve();
            }
          } else if (channelName.startsWith('bids:')) {
            const auctionId = channelName.replace('bids:', '');
            const callbacks = this.bidCallbacks.get(channelName);

            if (callbacks && callbacks.size > 0) {
              const newChannel = this.supabase
                .channel(channelName)
                .on(
                  'postgres_changes',
                  {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'bids',
                    filter: `auction_id=eq.${auctionId}`,
                  },
                  (payload) => {
                    this.handleBidInsert(payload, auctionId);
                  }
                )
                .on(
                  'postgres_changes',
                  {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'bids',
                    filter: `auction_id=eq.${auctionId}`,
                  },
                  (payload) => {
                    this.handleBidUpdate(payload, auctionId);
                  }
                )
                .subscribe((status) => {
                  console.log(`Reconnected bids channel ${channelName}:`, status);
                  resolve();
                });

              this.channels.set(channelName, newChannel);
            } else {
              resolve();
            }
          } else if (channelName === 'auctions:active') {
            const callbacks = this.auctionCallbacks.get(channelName);

            if (callbacks && callbacks.size > 0) {
              const newChannel = this.supabase
                .channel(channelName)
                .on(
                  'postgres_changes',
                  {
                    event: '*',
                    schema: 'public',
                    table: 'auctions',
                    filter: 'status=eq.active',
                  },
                  (payload) => {
                    this.handleAuctionChange(payload, null);
                  }
                )
                .subscribe((status) => {
                  console.log(`Reconnected active auctions channel:`, status);
                  resolve();
                });

              this.channels.set(channelName, newChannel);
            } else {
              resolve();
            }
          } else if (channelName.startsWith('creator:')) {
            const creatorId = channelName.replace('creator:', '');
            const callbacks = this.auctionCallbacks.get(channelName);

            if (callbacks && callbacks.size > 0) {
              const newChannel = this.supabase
                .channel(channelName)
                .on(
                  'postgres_changes',
                  {
                    event: '*',
                    schema: 'public',
                    table: 'auctions',
                    filter: `creator_id=eq.${creatorId}`,
                  },
                  (payload) => {
                    this.handleCreatorAuctionChange(payload, creatorId);
                  }
                )
                .subscribe((status) => {
                  console.log(`Reconnected creator auctions channel ${channelName}:`, status);
                  resolve();
                });

              this.channels.set(channelName, newChannel);
            } else {
              resolve();
            }
          } else {
            resolve();
          }
        }, 100);
      });

      reconnectPromises.push(promise);
    });

    await Promise.all(reconnectPromises);
    console.log('All channels reconnected');
  }
}

// Singleton instance
let realtimeManagerInstance: AuctionRealtimeManager | null = null;

export function getAuctionRealtimeManager(): AuctionRealtimeManager {
  if (!realtimeManagerInstance) {
    realtimeManagerInstance = new AuctionRealtimeManager();
  }
  return realtimeManagerInstance;
}
