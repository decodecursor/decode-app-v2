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
            className={`p-4 rounded-lg border transition-colors ${
              !payout.payout_unlocked
                ? 'bg-amber-500/5 border-amber-500/30 opacity-60'
                : selectedAuctionIds.has(payout.auction_id)
                  ? 'bg-purple-500/20 border-purple-500/50'
                  : 'bg-green-500/5 border-green-500/30'
            }`}
          >
            {/* Main Row */}
            <div className="flex items-start gap-4">
              {/* Checkbox - Left side */}
              <div className="flex items-center pt-1">
                <input
                  type="checkbox"
                  checked={selectedAuctionIds.has(payout.auction_id)}
                  disabled={!payout.payout_unlocked}
                  onChange={() => onToggleSelection(payout.auction_id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm md:text-base truncate">
                  {payout.auction_title}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Ended: {formatDate(payout.ended_at)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base md:text-lg font-bold text-green-400">
                  {formatCurrency(payout.model_amount)}
                </p>
              </div>
            </div>

            {/* Status Row */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {payout.payout_unlocked ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-green-400">
                      {payout.video_watched ? 'Video Watched - Payout Unlocked' : 'Payout Unlocked'}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm text-amber-400">Watch Video to Unlock</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Watch Video Button (only for locked payouts) */}
                {!payout.payout_unlocked && payout.has_video && (
                  <button
                    onClick={() => onWatchVideo(payout.auction_id, payout.auction_title)}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                  >
                    Watch Video
                  </button>
                )}

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => toggleExpanded(payout.auction_id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
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
