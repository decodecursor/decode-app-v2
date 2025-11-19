/**
 * Auction Card Component
 * Display auction summary with live timer and current price
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { CompactAuctionTimer } from './AuctionTimer';
import { formatBidAmount } from '@/lib/models/Bid.model';
import type { Auction } from '@/lib/models/Auction.model';
import { isAuctionEnded } from '@/lib/models/Auction.model';

interface AuctionCardProps {
  auction: Auction;
  showCreator?: boolean;
}

export function AuctionCard({ auction, showCreator = false }: AuctionCardProps) {
  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const hasBids = auction.total_bids > 0;

  // Status badge
  const getStatusBadge = () => {
    // Check actual end time first, regardless of database status
    if (isAuctionEnded(auction)) {
      return (
        <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
          Ended
        </span>
      );
    }

    switch (auction.status) {
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
            Live
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
            Upcoming
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
            Cancelled
          </span>
        );
      case 'ended':
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
            Ended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Link href={`/auctions/${auction.id}`}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {auction.title}
              </h3>
              {auction.description && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {auction.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {auction.status === 'active' && !isAuctionEnded(auction) && (
                <CompactAuctionTimer auction={auction} />
              )}
              {getStatusBadge()}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Current/Starting Price */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isAuctionEnded(auction) && auction.winner_name
                  ? 'Winning Bid'
                  : hasBids
                  ? 'Current Bid'
                  : 'Starting Price'}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatBidAmount(hasBids ? currentPrice : startPrice)}
              </p>
            </div>

            {/* Bid Count */}
            <div className="text-center pl-10">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Bids</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {auction.total_bids}
              </p>
            </div>

            {/* Bidder Count */}
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Bidders</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {auction.unique_bidders}
              </p>
            </div>
          </div>
        </div>

        {/* Winner Info */}
        {(auction.status === 'ended' || auction.status === 'completed' || isAuctionEnded(auction)) && auction.winner_name && (
          <div className="px-4 py-3 bg-green-50 border-t border-green-100">
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-700 font-medium">
                Won by {auction.winner_name}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * Auction Card Skeleton (loading state)
 */
export function AuctionCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-100">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-full" />
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-24" />
          </div>
          <div>
            <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-12" />
          </div>
        </div>
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-32" />
      </div>
    </div>
  );
}
