/**
 * Auctions Listing Page
 * Public page showing all active auctions
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useActiveAuctions } from '@/lib/hooks/useAuctionRealtime';
import { useAuctionCardsData } from '@/lib/hooks/useAuctionCardsData';
import { AuctionCard, AuctionCardSkeleton } from '@/components/auctions/AuctionCard';
import type { AuctionStatus } from '@/lib/models/Auction.model';

export default function AuctionsPage() {
  const { auctions, isConnected } = useActiveAuctions();
  const { enrichedAuctions, isLoading } = useAuctionCardsData(auctions);
  const [filter, setFilter] = useState<AuctionStatus | 'all'>('active');
  const [readyCards, setReadyCards] = useState(0);
  const [allCardsReady, setAllCardsReady] = useState(false);

  // Filter auctions based on status
  const filteredAuctions = enrichedAuctions.filter((auction) => {
    if (filter === 'all') return true;
    return auction.status === filter;
  });

  // Handle card ready callback
  const handleCardReady = useCallback(() => {
    setReadyCards(prev => prev + 1);
  }, []);

  // Reset ready count when filtered auctions change
  useEffect(() => {
    setReadyCards(0);
    setAllCardsReady(false);
  }, [filteredAuctions.length, isLoading]);

  // Check if all cards are ready
  useEffect(() => {
    if (!isLoading && filteredAuctions.length > 0 && readyCards >= filteredAuctions.length) {
      setAllCardsReady(true);
    } else if (!isLoading && filteredAuctions.length === 0) {
      // No cards to render, mark as ready immediately
      setAllCardsReady(true);
    }
  }, [isLoading, filteredAuctions.length, readyCards]);

  // Show loading spinner while coordinating all card data OR waiting for cards to render
  if (isLoading || !allCardsReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Live Auctions</h1>
              <p className="mt-2 text-gray-600">
                Bid on exclusive beauty experiences and services
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-6 flex gap-2">
            <FilterTab
              label="Active"
              count={enrichedAuctions.filter((a) => a.status === 'active').length}
              active={filter === 'active'}
              onClick={() => setFilter('active')}
            />
            <FilterTab
              label="All"
              count={enrichedAuctions.length}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
          </div>
        </div>
      </div>

      {/* Auctions Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {enrichedAuctions.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active auctions</h3>
            <p className="text-gray-600">Check back soon for new auctions!</p>
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No auctions match your filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                videoData={auction.videoData}
                businessData={auction.businessData}
                showCreator
                onReady={handleCardReady}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <InfoCard
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            }
            title="No Signup Required"
            description="Bid as a guest with just your name and email. We'll only contact you about your bids."
          />
          <InfoCard
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            }
            title="Secure Payments"
            description="We pre-authorize your payment method. You're only charged if you win the auction."
          />
          <InfoCard
            icon={
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            }
            title="Winner Video"
            description="Win an auction and share a 10-second video message with the creator!"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Filter Tab Component
 */
function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label} ({count})
    </button>
  );
}

/**
 * Info Card Component
 */
function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
