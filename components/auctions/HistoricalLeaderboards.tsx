/**
 * Historical Leaderboards Component
 * Displays previous completed auctions by the same creator with top 3 winners
 */

'use client';

import React, { useState, useEffect } from 'react';
import { formatBidAmount } from '@/lib/models/Bid.model';

/**
 * Instagram Icon Component
 */
function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

/**
 * Alternating Time/Instagram Username Component
 * Toggles between showing time and Instagram username every 3 seconds
 */
function AlternatingTimeUsername({
  time,
  instagramUsername
}: {
  time: string;
  instagramUsername?: string;
}) {
  const [showInstagram, setShowInstagram] = useState(false);

  useEffect(() => {
    // Only toggle if Instagram username exists
    if (!instagramUsername) return;

    const interval = setInterval(() => {
      setShowInstagram((prev) => !prev);
    }, 3000); // Toggle every 3 seconds

    return () => clearInterval(interval);
  }, [instagramUsername]);

  // If no Instagram username, just show time
  if (!instagramUsername) {
    return <p className="text-xs text-gray-500">{time}</p>;
  }

  // Alternate between time and Instagram username
  return (
    <p className="text-xs text-gray-500 flex items-center gap-1">
      {showInstagram ? (
        <>
          <InstagramIcon className="w-3 h-3 text-pink-600" />
          <a
            href={`https://www.instagram.com/${instagramUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-pink-600 hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {instagramUsername}
          </a>
        </>
      ) : (
        <span>{time}</span>
      )}
    </p>
  );
}

interface LeaderboardEntry {
  rank: number;
  bidder_name: string;
  bid_amount: number;
  placed_at: string;
  bidder_instagram_username?: string;
}

interface PreviousAuction {
  id: string;
  title: string;
  end_time: string;
  auction_current_price: number;
  total_bids: number;
  leaderboard?: LeaderboardEntry[];
}

interface HistoricalLeaderboardsProps {
  creatorId: string;
  currentAuctionId: string;
}

export function HistoricalLeaderboards({ creatorId, currentAuctionId }: HistoricalLeaderboardsProps) {
  const [auctions, setAuctions] = useState<PreviousAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState({
    auctionsFetched: 0,
    auctionsWithBids: 0,
    auctionsWithoutBids: 0,
    fetchErrors: [] as string[]
  });

  useEffect(() => {
    fetchPreviousAuctions();
  }, [creatorId, currentAuctionId]);

  const fetchPreviousAuctions = async () => {
    try {
      setIsLoading(true);
      console.log(`[HistoricalLeaderboards] Fetching completed auctions for creator ${creatorId}`);

      // Fetch all completed auctions by same creator
      const response = await fetch(`/api/auctions/list?creator_id=${creatorId}&status=completed`);
      const data = await response.json();

      if (data.success) {
        console.log(`[HistoricalLeaderboards] Found ${data.auctions?.length || 0} completed auctions`);

        // Filter out current auction
        const previousAuctions = data.auctions.filter(
          (a: PreviousAuction) => a.id !== currentAuctionId
        );

        console.log(`[HistoricalLeaderboards] ${previousAuctions.length} past auctions after filtering out current auction`);

        // Fetch leaderboard for each auction (top 3)
        const auctionsWithLeaderboards = await Promise.all(
          previousAuctions.map(async (auction: PreviousAuction) => {
            try {
              const lbResponse = await fetch(`/api/auctions/${auction.id}/leaderboard?limit=3`);
              const lbData = await lbResponse.json();

              const bidCount = lbData.leaderboard?.length || 0;
              const dbBidCount = auction.total_bids || 0;

              // Warn if auction has bids in DB but none confirmed in leaderboard
              if (dbBidCount > 0 && bidCount === 0) {
                console.warn(
                  `[HistoricalLeaderboards] Auction "${auction.title}" has ${dbBidCount} total bids in DB but 0 confirmed bids in leaderboard`
                );
              }

              return {
                ...auction,
                leaderboard: lbData.leaderboard || []
              };
            } catch (error) {
              console.error(`[HistoricalLeaderboards] Error fetching leaderboard for auction ${auction.id}:`, error);
              return { ...auction, leaderboard: [] };
            }
          })
        );

        // Sort by end_time descending (newest first)
        auctionsWithLeaderboards.sort((a, b) =>
          new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
        );

        // Update diagnostics
        const withBids = auctionsWithLeaderboards.filter(a => a.leaderboard && a.leaderboard.length > 0).length;
        const withoutBids = auctionsWithLeaderboards.filter(a => !a.leaderboard || a.leaderboard.length === 0).length;

        setDiagnostics({
          auctionsFetched: auctionsWithLeaderboards.length,
          auctionsWithBids: withBids,
          auctionsWithoutBids: withoutBids,
          fetchErrors: []
        });

        console.log(`[HistoricalLeaderboards] Summary: ${withBids} with bids, ${withoutBids} without confirmed bids`);

        setAuctions(auctionsWithLeaderboards);
      }
    } catch (error) {
      console.error('[HistoricalLeaderboards] Error fetching previous auctions:', error);
      setDiagnostics(prev => ({
        ...prev,
        fetchErrors: [String(error)]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Past Auctions</h3>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="space-y-2 bg-gray-50 rounded-md p-3">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Case 1: No past auctions at all
  if (auctions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Auctions</h3>
        <div className="text-center py-8">
          <svg
            className="mx-auto w-12 h-12 text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
            />
          </svg>
          <p className="text-sm text-gray-500">No past auctions yet</p>
          <p className="text-xs text-gray-400 mt-1">Previous completed auctions will appear here</p>
        </div>
      </div>
    );
  }

  // Case 2: Past auctions exist but none have confirmed bids
  const allAuctionsEmpty = auctions.every(a => !a.leaderboard || a.leaderboard.length === 0);
  if (allAuctionsEmpty) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Past Auctions</h3>
        <div className="text-center py-8">
          <svg
            className="mx-auto w-12 h-12 text-amber-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-gray-600">Past auctions pending bid confirmation</p>
          <p className="text-xs text-gray-500 mt-2">
            Auctions appear here once bids are confirmed with payment authorization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Past Auctions</h3>
        </div>
      </div>

      {/* Cards container - extends naturally based on content */}
      <div className="space-y-4">
        {auctions.map((auction) => (
          <div key={auction.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-400 transition-all duration-200">
            {/* Auction summary */}
            <div className="mb-3">
              <a
                href={`/auctions/${auction.id}`}
                className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors block truncate"
              >
                {auction.title}
              </a>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(auction.end_time).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })} · {auction.total_bids} bid{auction.total_bids !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Mini leaderboard (top 3) */}
            {auction.leaderboard && auction.leaderboard.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {auction.leaderboard.map((entry) => {
                  const timeAgo = new Date(entry.placed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div
                      key={entry.rank}
                      className="flex items-center justify-between text-sm py-3 px-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex-shrink-0 text-xl">{getMedalEmoji(entry.rank)}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900 font-medium block truncate">{entry.bidder_name}</span>
                          <AlternatingTimeUsername
                            time={timeAgo}
                            instagramUsername={entry.bidder_instagram_username}
                          />
                        </div>
                      </div>
                      <span className="font-semibold ml-2 flex-shrink-0 text-gray-900 text-sm">
                        {formatBidAmount(entry.bid_amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3">
                <p className="text-xs text-gray-500 text-center">
                  {auction.total_bids > 0
                    ? `${auction.total_bids} bid${auction.total_bids !== 1 ? 's' : ''} pending confirmation`
                    : 'No bids recorded'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Development diagnostics panel */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 p-3 bg-gray-50 rounded text-xs border border-gray-200">
          <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
            Debug Info
          </summary>
          <div className="mt-2 space-y-1 text-gray-600">
            <p><span className="font-medium">Auctions fetched:</span> {diagnostics.auctionsFetched}</p>
            <p><span className="font-medium">With confirmed bids:</span> {diagnostics.auctionsWithBids}</p>
            <p><span className="font-medium">Without confirmed bids:</span> {diagnostics.auctionsWithoutBids}</p>
            {diagnostics.fetchErrors.length > 0 && (
              <p className="text-red-600">
                <span className="font-medium">Errors:</span> {diagnostics.fetchErrors.join(', ')}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
