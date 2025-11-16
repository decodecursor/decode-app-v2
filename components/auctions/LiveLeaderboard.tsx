/**
 * Live Leaderboard Component
 * Displays real-time bid rankings with bidder names
 */

'use client';

import React from 'react';
import { useLeaderboard, formatLeaderboardEntry } from '@/lib/hooks/useLeaderboard';
import { formatBidAmount } from '@/lib/models/Bid.model';

interface LiveLeaderboardProps {
  auctionId: string;
  userEmail?: string;
  limit?: number;
  showStats?: boolean;
  className?: string;
}

export function LiveLeaderboard({
  auctionId,
  userEmail,
  limit = 10,
  showStats = true,
  className = '',
}: LiveLeaderboardProps) {
  const { leaderboard, stats, isConnected, isLoading, userRank, userHighestBid } = useLeaderboard(
    auctionId,
    userEmail,
    limit
  );

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
        </div>

        {/* User's position */}
        {userRank && userHighestBid && (
          <div className="mt-2 px-3 py-2 bg-blue-50 rounded-md">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700 font-medium">Your Position: #{userRank}</span>
              <span className="text-blue-900 font-semibold">
                {formatBidAmount(userHighestBid)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard List */}
      <div className="divide-y divide-gray-100">
        {leaderboard.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <svg
              className="mx-auto w-12 h-12 text-gray-300 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>No bids yet. Be the first to bid!</p>
          </div>
        ) : (
          leaderboard.map((entry) => {
            const formatted = formatLeaderboardEntry(entry);
            const isUser = entry.is_current_user;
            const isWinning = entry.rank === 1;

            return (
              <div
                key={entry.id}
                className={`px-4 py-3 transition-colors ${
                  isUser ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8">
                    {entry.rank === 1 ? (
                      <span className="text-xl">🥇</span>
                    ) : entry.rank === 2 ? (
                      <span className="text-xl">🥈</span>
                    ) : entry.rank === 3 ? (
                      <span className="text-xl">🥉</span>
                    ) : (
                      <span className="text-sm font-medium text-gray-500">
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Bidder Name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isUser ? 'text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      {formatted.bidder}
                    </p>
                    <p className="text-xs text-gray-500">{formatted.time}</p>
                  </div>

                  {/* Bid Amount */}
                  <div className="flex-shrink-0 text-right">
                    <p
                      className={`text-lg font-bold ${
                        isWinning
                          ? 'text-green-600'
                          : isUser
                          ? 'text-blue-900'
                          : 'text-gray-900'
                      }`}
                    >
                      {formatted.amount}
                    </p>
                    {isWinning && (
                      <span className="text-xs text-green-600 font-medium">Winning</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Statistics */}
      {showStats && stats && stats.total_bids > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Bids</p>
              <p className="text-lg font-semibold text-gray-900">{stats.total_bids}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Bidders</p>
              <p className="text-lg font-semibold text-gray-900">{stats.unique_bidders}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Avg Bid</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatBidAmount(stats.average_bid)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Leaderboard Skeleton (loading state)
 */
export function LeaderboardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 animate-pulse">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded w-40" />
      </div>
      <div className="divide-y divide-gray-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-6 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-6 bg-gray-200 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
