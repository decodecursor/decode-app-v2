/**
 * useLeaderboard Hook
 * React hook for live auction leaderboard with real-time bid updates
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAuctionRealtimeManager, type BidEvent } from '@/lib/realtime/AuctionRealtimeManager';
import type { Bid, LeaderboardEntry } from '@/lib/models/Bid.model';
import { formatBidderNameForLeaderboard, formatBidAmount } from '@/lib/models/Bid.model';
import { usePageVisibility } from './usePageVisibility';

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
  const { visibilityChangeCount } = usePageVisibility();

  // Fetch initial leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/auctions/${auctionId}/leaderboard?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();

        // Convert to leaderboard entries
        const entries: LeaderboardEntry[] = data.leaderboard.map((item: any, index: number) => ({
          id: `bid-${index}`,
          bidder_name: item.bidder_name,
          bid_amount: item.bid_amount,
          placed_at: item.placed_at,
          is_current_user: userEmail ? item.bidder_email === userEmail : false,
          rank: item.rank,
        }));

        setLeaderboard(entries);
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [auctionId, limit, userEmail]);

  // Update leaderboard from bids
  const updateLeaderboard = useCallback((bids: Bid[]) => {
    // Filter to only include bids with confirmed payment
    const validBids = bids.filter((b) => b.status === 'winning' || b.status === 'outbid' || b.status === 'captured');

    // Only update if we have valid bids, otherwise keep existing leaderboard
    if (validBids.length === 0) {
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
    }));

    setLeaderboard(entries);

    // Calculate stats
    if (sorted.length > 0) {
      const amounts = sorted.map((b) => Number(b.bid_amount));
      const uniqueBidders = new Set(sorted.map((b) => b.bidder_email)).size;

      setStats({
        total_bids: sorted.length,
        unique_bidders: uniqueBidders,
        highest_bid: Math.max(...amounts),
        lowest_bid: Math.min(...amounts),
        average_bid: amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length,
      });
    }
  }, [limit, userEmail]);

  // Handle new bid event
  const handleBidEvent = useCallback(
    (event: BidEvent) => {
      if (event.type === 'new_bid') {
        // Add new bid to list
        setAllBids((prev) => {
          const updated = [...prev, event.bid];
          updateLeaderboard(updated);
          return updated;
        });
      } else if (event.type === 'bid_updated') {
        // If bid is now valid (winning/outbid/captured), refresh from API
        if (event.bid.status === 'winning' || event.bid.status === 'outbid' || event.bid.status === 'captured') {
          fetchLeaderboard();
        }
        // Update existing bid
        setAllBids((prev) => {
          const updated = prev.map((b) => (b.id === event.bid.id ? event.bid : b));
          updateLeaderboard(updated);
          return updated;
        });
      }
    },
    [updateLeaderboard, fetchLeaderboard]
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
