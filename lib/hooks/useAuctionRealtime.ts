/**
 * useAuctionRealtime Hook
 * React hook for subscribing to real-time auction updates
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAuctionRealtimeManager, type AuctionEvent } from '@/lib/realtime/AuctionRealtimeManager';
import type { Auction } from '@/lib/models/Auction.model';

export function useAuctionRealtime(auctionId: string, initialAuction?: Auction) {
  const [auction, setAuction] = useState<Auction | null>(initialAuction || null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AuctionEvent | null>(null);

  // Fetch auction data
  const fetchAuction = useCallback(async () => {
    try {
      console.log('🔍 [useAuctionRealtime] Fetching auction:', auctionId);
      const response = await fetch(`/api/auctions/${auctionId}`);
      console.log('📥 [useAuctionRealtime] Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📋 [useAuctionRealtime] Response data:', data);

      if (response.ok) {
        console.log('✅ [useAuctionRealtime] Auction loaded:', data.auction);
        setAuction(data.auction);
      } else {
        console.error('❌ [useAuctionRealtime] Failed to fetch auction:', {
          status: response.status,
          error: data.error,
          fullResponse: data
        });
      }
    } catch (error) {
      console.error('💥 [useAuctionRealtime] Exception fetching auction:', error);
    }
  }, [auctionId]);

  useEffect(() => {
    const realtimeManager = getAuctionRealtimeManager();

    // Handle auction updates
    const handleAuctionEvent = (event: AuctionEvent) => {
      setLastEvent(event);
      setAuction(event.auction);

      // Log different event types
      switch (event.type) {
        case 'auction_started':
          console.log('Auction started:', event.auction.id);
          break;
        case 'auction_ended':
          console.log('Auction ended:', event.auction.id);
          break;
        case 'auction_updated':
          console.log('Auction updated:', event.auction.id);
          break;
      }
    };

    // Subscribe to auction updates
    const unsubscribe = realtimeManager.subscribeToAuction(auctionId, handleAuctionEvent);

    // Check connection status
    const checkConnection = setInterval(() => {
      const status = realtimeManager.getConnectionStatus(`auction:${auctionId}`);
      setIsConnected(status === 'subscribed');
    }, 1000);

    // Initial fetch if no initial auction provided
    if (!initialAuction) {
      fetchAuction();
    }

    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(checkConnection);
    };
  }, [auctionId, initialAuction, fetchAuction]);

  // Refresh auction data
  const refresh = useCallback(() => {
    return fetchAuction();
  }, [fetchAuction]);

  return {
    auction,
    isConnected,
    lastEvent,
    refresh,
  };
}

/**
 * useActiveAuctions Hook
 * Subscribe to all active auctions
 */
export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch all active auctions
  const fetchAuctions = useCallback(async () => {
    try {
      const response = await fetch('/api/auctions/list?status=active');
      if (response.ok) {
        const data = await response.json();
        setAuctions(data.auctions);
      }
    } catch (error) {
      console.error('Error fetching active auctions:', error);
    }
  }, []);

  useEffect(() => {
    const realtimeManager = getAuctionRealtimeManager();

    // Handle auction events
    const handleAuctionEvent = (event: AuctionEvent) => {
      setAuctions((prev) => {
        const existing = prev.find((a) => a.id === event.auction.id);

        if (event.type === 'auction_ended') {
          // Remove ended auctions
          return prev.filter((a) => a.id !== event.auction.id);
        } else if (existing) {
          // Update existing auction
          return prev.map((a) => (a.id === event.auction.id ? event.auction : a));
        } else if (event.type === 'auction_started') {
          // Add new auction
          return [...prev, event.auction];
        }

        return prev;
      });
    };

    // Subscribe to active auctions
    const unsubscribe = realtimeManager.subscribeToActiveAuctions(handleAuctionEvent);

    // Check connection
    const checkConnection = setInterval(() => {
      const status = realtimeManager.getConnectionStatus('auctions:active');
      setIsConnected(status === 'subscribed');
    }, 1000);

    // Initial fetch
    fetchAuctions();

    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(checkConnection);
    };
  }, [fetchAuctions]);

  return {
    auctions,
    isConnected,
    refresh: fetchAuctions,
  };
}
