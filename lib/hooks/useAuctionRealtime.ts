/**
 * useAuctionRealtime Hook
 * React hook for subscribing to real-time auction updates
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAuctionRealtimeManager, type AuctionEvent } from '@/lib/realtime/AuctionRealtimeManager';
import type { Auction } from '@/lib/models/Auction.model';
import { usePageVisibility } from './usePageVisibility';

export function useAuctionRealtime(auctionId: string, initialAuction?: Auction) {
  const [auction, setAuction] = useState<Auction | null>(initialAuction || null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AuctionEvent | null>(null);
  const [error, setError] = useState<{ message: string; statusCode?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { visibilityChangeCount } = usePageVisibility();

  // Schedule retry with exponential backoff
  const scheduleRetry = useCallback(() => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000); // Exponential backoff, max 8s
    console.log(`🔄 [useAuctionRealtime] Retry #${retryCount + 1} scheduled in ${delay}ms`);

    setTimeout(() => {
      setRetryCount(prev => prev + 1);
      fetchAuction(true);
    }, delay);
  }, [retryCount]);

  // Fetch auction data with timeout and error handling
  const fetchAuction = useCallback(async (isRetry: boolean = false) => {
    try {
      if (!isRetry) {
        setIsLoading(true);
        setError(null);
      }

      console.log('🔍 [useAuctionRealtime] Fetching auction:', auctionId);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/api/auctions/${auctionId}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📥 [useAuctionRealtime] Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📋 [useAuctionRealtime] Response data:', data);

      if (response.ok) {
        console.log('✅ [useAuctionRealtime] Auction loaded:', data.auction);
        setAuction(data.auction);
        setError(null);
        setRetryCount(0);
      } else {
        // API returned error response
        const errorMessage = data.error || 'Failed to load auction';
        console.error('❌ [useAuctionRealtime] Failed to fetch auction:', {
          status: response.status,
          error: errorMessage,
          fullResponse: data
        });

        // Set user-friendly error message based on status code
        setError({
          message: response.status === 404
            ? 'Auction not found'
            : response.status >= 500
              ? 'Server error - please try again'
              : errorMessage,
          statusCode: response.status
        });

        // Don't retry on 404 (permanent error), but retry on 500s and other errors
        if (response.status !== 404 && retryCount < 3) {
          scheduleRetry();
        }
      }
    } catch (error) {
      console.error('💥 [useAuctionRealtime] Exception fetching auction:', error);

      // Determine error type
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const isNetworkError = error instanceof TypeError;

      setError({
        message: isTimeout
          ? 'Request timed out - please check your connection'
          : isNetworkError
            ? 'Network error - please check your connection'
            : 'Failed to load auction',
        statusCode: undefined
      });

      // Auto-retry on network errors and timeouts (but not other errors)
      if ((isTimeout || isNetworkError) && retryCount < 3) {
        scheduleRetry();
      }
    } finally {
      setIsLoading(false);
    }
  }, [auctionId, retryCount, scheduleRetry]);

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
        case 'auction_cancelled':
          console.log('Auction cancelled:', event.auction.id);
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

  // Handle page visibility changes (critical for mobile)
  useEffect(() => {
    if (visibilityChangeCount > 0) {
      console.log('📱 [useAuctionRealtime] Page became visible, reconnecting and refreshing...');
      const realtimeManager = getAuctionRealtimeManager();

      // Reconnect WebSocket channels first
      realtimeManager.reconnectAll().then(() => {
        // Then fetch fresh data
        fetchAuction();
      });
    }
  }, [visibilityChangeCount, fetchAuction]);

  // Refresh auction data
  const refresh = useCallback(() => {
    return fetchAuction();
  }, [fetchAuction]);

  return {
    auction,
    isConnected,
    lastEvent,
    error,
    isLoading,
    refresh,
    retry: () => {
      setRetryCount(0);
      setError(null);
      fetchAuction(false);
    }
  };
}

/**
 * useActiveAuctions Hook
 * Subscribe to all active auctions
 */
export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { visibilityChangeCount } = usePageVisibility();

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

  // Handle page visibility changes (critical for mobile)
  useEffect(() => {
    if (visibilityChangeCount > 0) {
      console.log('📱 [useActiveAuctions] Page became visible, reconnecting and refreshing...');
      const realtimeManager = getAuctionRealtimeManager();

      // Reconnect WebSocket channels first
      realtimeManager.reconnectAll().then(() => {
        // Then fetch fresh data
        fetchAuctions();
      });
    }
  }, [visibilityChangeCount, fetchAuctions]);

  return {
    auctions,
    isConnected,
    refresh: fetchAuctions,
  };
}

/**
 * useCreatorAuctions Hook
 * Subscribe to all auctions created by a specific creator
 */
export function useCreatorAuctions(creatorId: string) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { visibilityChangeCount } = usePageVisibility();

  // Fetch creator's auctions
  const fetchAuctions = useCallback(async () => {
    try {
      console.log('🔍 [useCreatorAuctions] Fetching auctions for creator:', creatorId);
      const response = await fetch(`/api/auctions/list?creator_id=${creatorId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [useCreatorAuctions] Loaded auctions:', data.auctions.length);
        setAuctions(data.auctions);
      }
    } catch (error) {
      console.error('❌ [useCreatorAuctions] Error fetching creator auctions:', error);
    }
  }, [creatorId]);

  useEffect(() => {
    const realtimeManager = getAuctionRealtimeManager();

    // Handle auction events
    const handleAuctionEvent = (event: AuctionEvent) => {
      console.log(`📡 [useCreatorAuctions] Received ${event.type} for auction:`, event.auction.id);

      setAuctions((prev) => {
        const existing = prev.find((a) => a.id === event.auction.id);

        if (event.type === 'auction_cancelled' || event.type === 'auction_ended') {
          // Update the auction (don't remove it, as dashboard shows all statuses)
          if (existing) {
            return prev.map((a) => (a.id === event.auction.id ? event.auction : a));
          }
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

    // Subscribe to creator auctions
    const unsubscribe = realtimeManager.subscribeToCreatorAuctions(creatorId, handleAuctionEvent);

    // Check connection
    const checkConnection = setInterval(() => {
      const status = realtimeManager.getConnectionStatus(`creator:${creatorId}`);
      setIsConnected(status === 'subscribed');
    }, 1000);

    // Initial fetch
    fetchAuctions();

    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(checkConnection);
    };
  }, [creatorId, fetchAuctions]);

  // Handle page visibility changes (critical for mobile)
  useEffect(() => {
    if (visibilityChangeCount > 0) {
      console.log('📱 [useCreatorAuctions] Page became visible, reconnecting and refreshing...');
      const realtimeManager = getAuctionRealtimeManager();

      // Reconnect WebSocket channels first
      realtimeManager.reconnectAll().then(() => {
        // Then fetch fresh data
        fetchAuctions();
      });
    }
  }, [visibilityChangeCount, fetchAuctions]);

  return {
    auctions,
    isConnected,
    refresh: fetchAuctions,
  };
}
