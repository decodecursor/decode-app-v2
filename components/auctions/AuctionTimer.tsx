/**
 * Auction Timer Component
 * Displays live countdown with anti-sniping indicator
 */

'use client';

import React from 'react';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import type { Auction } from '@/lib/models/Auction.model';

interface AuctionTimerProps {
  auction: Auction;
  showProgress?: boolean;
  className?: string;
}

export function AuctionTimer({ auction, showProgress = false, className = '' }: AuctionTimerProps) {
  const { formatted, isEnding, isCritical, hasEnded, wasExtended, progress, timeUnits } =
    useAuctionTimer(auction);

  // Determine color based on time remaining
  const getTimerColor = () => {
    if (hasEnded) return 'text-gray-900';
    if (isCritical) return 'text-red-600 font-bold animate-pulse';
    if (isEnding) return 'text-orange-500 font-semibold';
    return 'text-gray-900';
  };

  // Determine background color for progress bar
  const getProgressColor = () => {
    if (hasEnded) return 'bg-gray-400';
    if (isCritical) return 'bg-red-500';
    if (isEnding) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  return (
    <div className={`space-y-1 sm:space-y-2 ${className}`}>
      {/* Timer Display */}
      <div className="flex items-center gap-2">
        <svg
          className={`w-[19px] h-[19px] sm:w-[29px] sm:h-[29px] ${hasEnded ? 'text-gray-900' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className={`text-[17px] sm:text-[27px] font-bold ${getTimerColor()}`}>
          {hasEnded ? 'Auction Ended' : formatted}
        </span>

        {/* Anti-sniping indicator */}
        {wasExtended && !hasEnded && (
          <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full animate-bounce">
            +60s
          </span>
        )}

        {/* Status badges */}
        {isEnding && !hasEnded && (
          <span className="px-1.5 py-0.5 text-[9px] font-medium text-orange-700 bg-orange-100 rounded-full">
            Ending Soon!
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && !hasEnded && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Compact Timer Component (for cards)
 */
export function CompactAuctionTimer({ auction }: { auction: Auction }) {
  const { formatted, isCritical, hasEnded } = useAuctionTimer(auction);

  return (
    <div className="flex items-center gap-1.5">
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span
        className={`text-sm ${
          hasEnded ? 'text-gray-500' : isCritical ? 'text-red-600 font-semibold' : 'text-gray-700'
        }`}
      >
        {formatted}
      </span>
    </div>
  );
}
