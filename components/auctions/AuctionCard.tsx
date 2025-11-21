/**
 * Auction Card Component
 * Display auction summary with live timer and current price
 */

'use client';

import React, { useState } from 'react';
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
  const [shareSuccess, setShareSuccess] = useState(false);

  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const hasBids = auction.total_bids > 0;

  // Check if auction is active (not ended and status is active)
  const isActive = auction.status === 'active' && !isAuctionEnded(auction);

  // Handle share auction
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const auctionUrl = `${baseUrl}/auctions/${auction.id}`;

    try {
      await navigator.clipboard.writeText(auctionUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy auction link:', error);
    }
  };

  // Status badge
  const getStatusBadge = () => {
    // Check actual end time first, regardless of database status
    if (isAuctionEnded(auction)) {
      return (
        <span className="px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700/50 rounded-full">
          Ended
        </span>
      );
    }

    switch (auction.status) {
      case 'active':
        return (
          <span className="px-2 py-1 text-xs font-medium text-green-300 bg-green-700/30 rounded-full">
            Live
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs font-medium text-blue-300 bg-blue-700/30 rounded-full">
            Upcoming
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs font-medium text-red-300 bg-red-700/30 rounded-full">
            Cancelled
          </span>
        );
      case 'ended':
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700/50 rounded-full">
            Ended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Link href={`/auctions/${auction.id}`}>
      <div className={`relative overflow-hidden border border-gray-600 border-l-4 rounded-lg shadow-lg p-5 transition-all duration-300 cursor-pointer
        before:absolute before:inset-0 before:pointer-events-none before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out
        ${isActive
          ? 'bg-gray-900/80 border-l-purple-500 hover:border-purple-400 hover:bg-gray-800/80 hover:shadow-2xl hover:shadow-purple-400/60 hover:scale-[1.01]'
          : 'bg-blue-900/30 border-l-gray-500 hover:border-gray-400 hover:bg-blue-800/30 hover:shadow-2xl hover:shadow-gray-400/60 hover:scale-[1.01]'
        }`}
      >
        {/* Share Button */}
        <button
          onClick={handleShare}
          className={`absolute bottom-4 right-4 cosmic-button-secondary text-xs px-3 py-2 transition-all border border-white/30 rounded-lg hover:bg-white/10 z-10 ${
            shareSuccess ? 'bg-gray-500/20 text-gray-600 border-gray-500' : ''
          }`}
          title="Share auction"
        >
          {shareSuccess ? (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Shared!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </span>
          )}
        </button>

        {/* Header */}
        <div className="border-b border-gray-700 pb-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">
                {auction.title}
              </h3>
              {auction.description && (
                <p className="mt-1 text-sm text-gray-300 line-clamp-2">
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
        <div>
          <div className="grid grid-cols-3 gap-4">
            {/* Current/Starting Price */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                {isAuctionEnded(auction) && auction.winner_name
                  ? 'Winning Bid'
                  : hasBids
                  ? 'Current Bid'
                  : 'Starting Price'}
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {formatBidAmount(hasBids ? currentPrice : startPrice)}
              </p>
            </div>

            {/* Bid Count */}
            <div className="text-center pl-10">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Bids</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {auction.total_bids}
              </p>
            </div>

            {/* Bidder Count */}
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Bidders</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {auction.unique_bidders}
              </p>
            </div>
          </div>
        </div>

        {/* Winner Info */}
        {(auction.status === 'ended' || auction.status === 'completed' || isAuctionEnded(auction)) && auction.winner_name && (
          <div className="mt-4 pt-4 px-4 py-3 bg-green-900/20 border-t border-green-700/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-green-300 font-medium">
                Won by {auction.winner_name}
              </span>
            </div>
            {auction.winner_instagram_username && (
              <div className="mt-2 ml-6">
                <a
                  href={`https://instagram.com/${auction.winner_instagram_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-sm text-green-300 hover:text-green-200 hover:underline"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  @{auction.winner_instagram_username}
                </a>
              </div>
            )}
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
    <div className="bg-gray-900/80 border border-gray-600 border-l-4 border-l-purple-500 rounded-lg shadow-lg overflow-hidden animate-pulse p-5">
      <div className="border-b border-gray-700 pb-4 mb-4">
        <div className="h-6 bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-700 rounded w-full" />
      </div>
      <div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="h-3 bg-gray-700 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-700 rounded w-24" />
          </div>
          <div>
            <div className="h-3 bg-gray-700 rounded w-16 mb-2" />
            <div className="h-8 bg-gray-700 rounded w-12" />
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 px-4 py-3 bg-green-900/20 border-t border-green-700/30 rounded-lg">
        <div className="h-4 bg-gray-700 rounded w-32" />
      </div>
    </div>
  );
}
