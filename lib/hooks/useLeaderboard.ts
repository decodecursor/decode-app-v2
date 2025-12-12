/**
 * useLeaderboard Hook
 * React hook for live auction leaderboard with real-time bid updates
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getAuctionRealtimeManager, type BidEvent } from '@/lib/realtime/AuctionRealtimeManager';
import type { Bid, LeaderboardEntry } from '@/lib/models/Bid.model';
import { formatBidderNameForLeaderboard, formatBidAmount } from '@/lib/models/Bid.model';
import { usePageVisibility } from './usePageVisibility';

/**
 * Debounce utility function
 * Delays function execution until after a specified delay has passed since the last call
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

interface LeaderboardStats {
  total_bids: number;
  unique_bidders: number;
  highest_bid: number;
  lowest_bid: number;
  average_bid: number;
}

export function useLeaderboard(auctionId: string, userEmail?: string, limit: number = 10) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<number>(Date.now());
  const { visibilityChangeCount } = usePageVisibility();

  // Fetch initial leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    console.log('🔄 [useLeaderboard] Fetching leaderboard for auction:', auctionId);
    try {
      // Only show loading skeleton on initial load, not on background refreshes
      if (isInitialLoad) {
        setIsLoading(true);
      }

      const response = await fetch(`/api/auctions/${auctionId}/leaderboard?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();

        // Convert to leaderboard entries - use real bid ID from API
        const entries: LeaderboardEntry[] = data.leaderboard.map((item: any, index: number) => ({
          id: item.id || `bid-${index}`,
          bidder_name: item.bidder_name,
          bid_amount: item.bid_amount,
          placed_at: item.placed_at,
          is_current_user: userEmail ? item.bidder_email === userEmail : false,
          rank: item.rank,
          bidder_instagram_username: item.bidder_instagram_username,
        }));

        // MERGE LOGIC: Never reduce displayed entries during background fetches
        // Only applies after initial load (prevents flickering during payment processing)
        setLeaderboard((prevLeaderboard) => {
          if (!isInitialLoad && prevLeaderboard.length > 0) {
            // Create map of new entries by ID for quick lookup
            const newEntriesMap = new Map(entries.map(e => [e.id, e]));

            // Start with new entries
            const mergedEntries = [...entries];

            // Add any existing entries that aren't in new data (may be pending payment)
            for (const existing of prevLeaderboard) {
              if (!newEntriesMap.has(existing.id)) {
                mergedEntries.push(existing);
              }
            }

            // Re-sort and re-rank the merged list
            mergedEntries.sort((a, b) => {
              const amountDiff = b.bid_amount - a.bid_amount;
              if (amountDiff !== 0) return amountDiff;
              return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
            });

            // Assign correct ranks and limit to top N
            return mergedEntries.slice(0, limit).map((entry, index) => ({
              ...entry,
              rank: index + 1,
            }));
          }
          // Initial load: just set the entries directly
          return entries;
        });

        // Don't reduce bid counts during background fetches
        setStats((prevStats) => {
          if (!isInitialLoad && prevStats) {
            return {
              ...data.statistics,
              total_bids: Math.max(data.statistics.total_bids, prevStats.total_bids),
              unique_bidders: Math.max(data.statistics.unique_bidders, prevStats.unique_bidders),
            };
          }
          return data.statistics;
        });
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      // Only clear loading state on initial load
      if (isInitialLoad) {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [auctionId, limit, userEmail, isInitialLoad]);

  // Update leaderboard from bids
  const updateLeaderboard = useCallback((bids: Bid[]) => {
    // Filter to only include bids with confirmed payment
    const validBids = bids.filter((b) => b.status === 'winning' || b.status === 'outbid' || b.status === 'captured');

    // Only update if we have valid bids, otherwise keep existing leaderboard
    if (validBids.length === 0) {
      console.log('⚠️ [useLeaderboard] No valid bids to display', {
        total_bids: bids.length,
        bid_statuses: bids.map(b => ({ id: b.id, status: b.status }))
      });
      return;
    }

    // Sort bids by bid_amount (descending) and placed_at (ascending for tie-breaking)
    const sorted = [...validBids].sort((a, b) => {
      const amountDiff = Number(b.bid_amount) - Number(a.bid_amount);
      if (amountDiff !== 0) return amountDiff;
      return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
    });

    // Take top N and convert to leaderboard entries
    const entries: LeaderboardEntry[] = sorted.slice(0, limit).map((bid, index) => ({
      id: bid.id,
      bidder_name: formatBidderNameForLeaderboard(bid.bidder_name, false),
      bid_amount: Number(bid.bid_amount),
      placed_at: bid.placed_at,
      is_current_user: userEmail ? bid.bidder_email === userEmail : false,
      rank: index + 1,
      bidder_instagram_username: bid.bidder_instagram_username,
    }));

    // MERGE LOGIC: Preserve existing entries when realtime events update leaderboard
    // Prevents bids from disappearing if they weren't in allBids (only populated via realtime events)
    setLeaderboard((prevLeaderboard) => {
      if (prevLeaderboard.length > 0) {
        const newEntriesMap = new Map(entries.map(e => [e.id, e]));
        const mergedEntries = [...entries];

        // Preserve entries not in new data (may be from API but no realtime event yet)
        for (const existing of prevLeaderboard) {
          if (!newEntriesMap.has(existing.id)) {
            mergedEntries.push(existing);
          }
        }

        // Re-sort by amount desc, then time asc
        mergedEntries.sort((a, b) => {
          const amountDiff = b.bid_amount - a.bid_amount;
          if (amountDiff !== 0) return amountDiff;
          return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
        });

        // Limit to top N and assign ranks
        return mergedEntries.slice(0, limit).map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
      }
      return entries;
    });
  }, [limit, userEmail]);

  // Create debounced version of fetchLeaderboard
  // This prevents multiple rapid API calls when multiple bids are updated sequentially
  const debouncedFetchRef = useRef<(() => void) | null>(null);

  if (!debouncedFetchRef.current) {
    debouncedFetchRef.current = debounce(() => {
      fetchLeaderboard();
    }, 300); // 300ms delay to coalesce rapid updates
  }

  // Handle new bid event
  const handleBidEvent = useCallback(
    (event: BidEvent) => {
      // Record that we received a realtime event
      setLastRealtimeEvent(Date.now());

      if (event.type === 'new_bid') {
        // Add new bid to list
        setAllBids((prev) => {
          const updated = [...prev, event.bid];
          updateLeaderboard(updated);
          return updated;
        });
      } else if (event.type === 'bid_updated') {
        console.log('🔄 [useLeaderboard] Bid updated, applying optimistic update...', {
          bid_id: event.bid.id,
          status: event.bid.status,
          amount: event.bid.bid_amount
        });

        // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
        setAllBids((prev) => {
          // Check if bid exists in local state
          const existingIndex = prev.findIndex(b => b.id === event.bid.id);

          let updated;
          if (existingIndex >= 0) {
            // Update existing bid
            updated = prev.map((b) => (b.id === event.bid.id ? event.bid : b));
          } else {
            // Bid not in local state - ADD it (handles missed new_bid events or pending bids)
            console.log('📥 [useLeaderboard] Adding bid that was missing from local state:', event.bid.id);
            updated = [...prev, event.bid];
          }

          updateLeaderboard(updated); // Update UI instantly with new data
          return updated;
        });

        // VERIFICATION: Fetch from API in background (debounced)
        // Multiple rapid updates will be coalesced into a single API call
        if (debouncedFetchRef.current) {
          debouncedFetchRef.current();
        }
      }
    },
    [updateLeaderboard]
  );

  useEffect(() => {
    const realtimeManager = getAuctionRealtimeManager();

    // Subscribe to bid updates
    const unsubscribe = realtimeManager.subscribeToBids(auctionId, handleBidEvent);

    // Check connection status
    const checkConnection = setInterval(() => {
      const status = realtimeManager.getConnectionStatus(`bids:${auctionId}`);
      setIsConnected(status === 'subscribed');
    }, 1000);

    // Initial fetch
    fetchLeaderboard();

    // Cleanup
    return () => {
      unsubscribe();
      clearInterval(checkConnection);
    };
  }, [auctionId, fetchLeaderboard, handleBidEvent]);

  // Handle page visibility changes (critical for mobile)
  useEffect(() => {
    if (visibilityChangeCount > 0) {
      console.log('📱 [useLeaderboard] Page became visible, refreshing leaderboard...');
      // Fetch fresh leaderboard data when page becomes visible
      fetchLeaderboard();
    }
  }, [visibilityChangeCount, fetchLeaderboard]);

  // Polling fallback: Poll every 30 seconds if realtime appears stale
  useEffect(() => {
    const pollingInterval = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastRealtimeEvent;

      // If we haven't received a realtime event in 30+ seconds, fetch from API
      // This covers cases where WebSocket is disconnected or stale
      if (timeSinceLastEvent > 30000) {
        console.log('🔄 [useLeaderboard] No realtime events for 30s, polling for updates...');
        fetchLeaderboard();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(pollingInterval);
  }, [lastRealtimeEvent, fetchLeaderboard]);

  // Window focus listener: Refresh when user returns to tab (all browsers)
  useEffect(() => {
    const handleFocus = () => {
      console.log('👁️ [useLeaderboard] Window focused, refreshing leaderboard...');
      fetchLeaderboard();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchLeaderboard]);

  // Get user's rank
  const userRank = leaderboard.find((entry) => entry.is_current_user)?.rank || null;

  // Get user's highest bid
  const userHighestBid = allBids
    .filter((bid) => bid.bidder_email === userEmail)
    .sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount))[0];

  return {
    leaderboard,
    stats,
    isConnected,
    isLoading,
    userRank,
    userHighestBid: userHighestBid ? Number(userHighestBid.bid_amount) : null,
    refresh: fetchLeaderboard,
  };
}

/**
 * Format leaderboard entry for display
 */
export function formatLeaderboardEntry(entry: LeaderboardEntry): {
  rank: string;
  bidder: string;
  amount: string;
  time: string;
} {
  return {
    rank: `#${entry.rank}`,
    bidder: entry.is_current_user ? `${entry.bidder_name} (You)` : entry.bidder_name,
    amount: formatBidAmount(entry.bid_amount),
    time: new Date(entry.placed_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }),
  };
}
