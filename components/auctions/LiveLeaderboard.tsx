/**
 * Live Leaderboard Component
 * Displays real-time bid rankings with bidder names
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useLeaderboard, formatLeaderboardEntry } from '@/lib/hooks/useLeaderboard';
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

interface LiveLeaderboardProps {
  auctionId: string;
  userEmail?: string;
  limit?: number;
  showStats?: boolean;
  className?: string;
  isAuctionEnded?: boolean;
}

export function LiveLeaderboard({
  auctionId,
  userEmail,
  limit = 10,
  showStats = true,
  className = '',
  isAuctionEnded = false,
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
              className="mx-auto w-12 h-12 text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"
              />
            </svg>
            <p className="text-xs">No bids yet. Be the first to bid!</p>
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
                  <div className="flex-shrink-0 w-8 text-center">
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
                    {/* Show alternating time/Instagram for top 3 bidders */}
                    {entry.rank <= 3 ? (
                      <AlternatingTimeUsername
                        time={formatted.time}
                        instagramUsername={entry.bidder_instagram_username}
                      />
                    ) : (
                      <p className="text-xs text-gray-500">{formatted.time}</p>
                    )}
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
                      <p className="text-xs text-green-600 font-medium -mt-1">
                        {isAuctionEnded ? 'Winning Bid' : 'Highest Bid'}
                      </p>
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
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Bids</p>
              <p className="text-lg font-semibold text-gray-900">{stats.total_bids}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Bidders</p>
              <p className="text-lg font-semibold text-gray-900">{stats.unique_bidders}</p>
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
