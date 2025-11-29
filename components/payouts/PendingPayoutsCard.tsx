'use client';

import React, { useState } from 'react';

interface PendingPayoutItem {
  auction_id: string;
  auction_title: string;
  ended_at: string;
  model_amount: number;
  payout_status: string;
  winning_amount: number;
  start_price: number;
  profit_amount: number;
  platform_fee_amount: number;
  has_video: boolean;
  video_watched: boolean;
  payout_unlocked: boolean;
}

interface PendingPayoutsCardProps {
  pendingPayouts: PendingPayoutItem[];
  onWatchVideo: (auctionId: string, auctionTitle: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  selectedAuctionIds: Set<string>;
  onToggleSelection: (auctionId: string) => void;
}

export function PendingPayoutsCard({
  pendingPayouts,
  onWatchVideo,
  formatCurrency,
  formatDate,
  selectedAuctionIds,
  onToggleSelection
}: PendingPayoutsCardProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (auctionId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(auctionId)) {
      newExpanded.delete(auctionId);
    } else {
      newExpanded.add(auctionId);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="w-full cosmic-card mb-6">
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white">
          Pending Payouts
        </h3>
      </div>

      {!pendingPayouts || pendingPayouts.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No pending payouts yet. Your pending payouts will appear here.</p>
      ) : (
      <div className="space-y-3">
        {pendingPayouts.map((payout) => (
          <div
            key={payout.auction_id}
            className={`p-4 rounded-lg transition-colors bg-gray-900/80 ${
              selectedAuctionIds.has(payout.auction_id)
                ? 'border-2 border-purple-500'
                : 'border border-gray-600'
            } ${
              !payout.payout_unlocked ? 'opacity-60' : ''
            }`}
          >
            {/* Single Horizontal Row */}
            <div className="flex items-center gap-4 md:gap-6">
              {/* Checkbox */}
              <div className="relative flex items-center group">
                <input
                  type="checkbox"
                  checked={selectedAuctionIds.has(payout.auction_id)}
                  disabled={!payout.payout_unlocked}
                  onChange={() => onToggleSelection(payout.auction_id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {!payout.payout_unlocked && (
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-0 bg-gray-800 text-amber-400 text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                    Watch Video to Unlock
                  </div>
                )}
              </div>

              {/* Treatment Name */}
              <div className="flex-shrink-0 min-w-[100px] md:min-w-[150px]">
                <p className="font-semibold text-white text-sm md:text-base truncate">
                  {payout.auction_title}
                </p>
              </div>

              {/* Amount */}
              <div className="flex-shrink-0">
                <p className="text-sm md:text-base font-bold text-green-400">
                  {formatCurrency(payout.model_amount)}
                </p>
              </div>

              {/* End Date */}
              <div className="flex-shrink-0">
                <p className="text-xs md:text-sm text-gray-400">
                  {formatDate(payout.ended_at)}
                </p>
              </div>

              {/* Spacer to push buttons to the right */}
              <div className="flex-1"></div>

              {/* Watch Video Button (conditional) */}
              {!payout.payout_unlocked && payout.has_video && (
                <button
                  onClick={() => onWatchVideo(payout.auction_id, payout.auction_title)}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/30 flex-shrink-0"
                >
                  Watch Video
                </button>
              )}

              {/* Profit Breakdown Button */}
              <button
                onClick={() => toggleExpanded(payout.auction_id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors border border-white/10 flex-shrink-0"
              >
                <span>Profit Breakdown</span>
                <svg
                  className={`w-4 h-4 transition-transform ${expandedItems.has(payout.auction_id) ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Expandable Profit Breakdown */}
            {expandedItems.has(payout.auction_id) && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Winning Bid</span>
                    <span className="text-white font-medium">{formatCurrency(payout.winning_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Start Price</span>
                    <span className="text-red-400">-{formatCurrency(payout.start_price)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-gray-300 font-medium">Profit</span>
                    <span className="text-white font-medium">{formatCurrency(payout.profit_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Platform Fee (25%)</span>
                    <span className="text-red-400">-{formatCurrency(payout.platform_fee_amount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-green-400 font-semibold">Your Payout (75%)</span>
                    <span className="text-green-400 font-bold">{formatCurrency(payout.model_amount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
