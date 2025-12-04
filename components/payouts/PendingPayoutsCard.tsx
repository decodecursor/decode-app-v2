'use client';

import React, { useState } from 'react';
import { VideoUploadCountdown } from '@/components/auctions/VideoUploadCountdown';

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
  token_expires_at: string | null;
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
    <div className="w-full cosmic-card mb-6 overflow-hidden">
      <div className="mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white">
          Pending Payouts
        </h3>
      </div>

      {!pendingPayouts || pendingPayouts.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm">No pending payouts yet. Your pending payouts will appear here.</p>
      ) : (
      <div className="space-y-3">
        {pendingPayouts.map((payout) => (
          <div key={payout.auction_id} className="relative">
            {/* Card Layer - applies opacity when locked */}
            <div
              onClick={() => payout.payout_unlocked && onToggleSelection(payout.auction_id)}
              className={`p-3 md:p-4 rounded-lg transition-all bg-gray-900/80 ${
                selectedAuctionIds.has(payout.auction_id)
                  ? 'border border-purple-500'
                  : 'border border-gray-600'
              } ${!payout.payout_unlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-85'}`}
            >
              {/* Mobile: Stacked layout / Desktop: Horizontal row */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                {/* Row 1 on mobile: Checkbox + Title + Amount */}
                <div className="flex items-center gap-2 md:gap-3">
                  {/* Checkbox */}
                  <div className="flex items-center flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedAuctionIds.has(payout.auction_id)}
                      disabled={!payout.payout_unlocked}
                      readOnly
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 pointer-events-none disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Treatment Name */}
                  <div className="flex-1 min-w-0 md:w-40 md:flex-none">
                    <p className="font-semibold text-white text-sm md:text-base truncate">
                      {payout.auction_title}
                    </p>
                  </div>

                  {/* Amount - Visible on mobile row 1 */}
                  <div className="md:hidden flex-shrink-0">
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(payout.model_amount)}
                    </p>
                  </div>
                </div>

                {/* Desktop only: Amount and Date */}
                <div className="hidden md:flex md:items-center md:gap-4 md:flex-1">
                  {/* Amount */}
                  <div className="w-36">
                    <p className="text-base font-bold text-green-400">
                      {formatCurrency(payout.model_amount)}
                    </p>
                  </div>

                  {/* End Date */}
                  <div className="w-28">
                    <p className="text-sm text-white">
                      {formatDate(payout.ended_at)}
                    </p>
                  </div>

                  {/* Spacer to push buttons right */}
                  <div className="flex-1"></div>

                  {/* Placeholder for buttons (faded with card) - Desktop only */}
                  {!payout.payout_unlocked && (payout.has_video || (!payout.has_video && payout.token_expires_at && new Date(payout.token_expires_at).getTime() > Date.now())) && (
                    <div className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 flex-shrink-0 invisible min-w-[110px]">
                      {payout.has_video ? 'Watch Video' : 'Countdown'}
                    </div>
                  )}
                  <div className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white/2 text-gray-300 rounded-lg border border-white/10 flex-shrink-0 invisible">
                    <span>Profit Breakdown</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Row 2 on mobile: Date + Buttons */}
                <div className="flex md:hidden items-center justify-between gap-2 pl-6">
                  {/* End Date */}
                  <div className="flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {formatDate(payout.ended_at)}
                    </p>
                  </div>

                  {/* Mobile buttons row */}
                  <div className="flex items-center gap-1.5">
                    {/* Watch Video Button or Countdown - Only for locked cards */}
                    {!payout.payout_unlocked && payout.has_video && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onWatchVideo(payout.auction_id, payout.auction_title);
                        }}
                        className="flex items-center justify-center h-7 px-2 text-[10px] font-medium bg-amber-500/10 text-amber-400 rounded-md hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                      >
                        Watch Video
                      </button>
                    )}
                    {!payout.payout_unlocked && !payout.has_video && payout.token_expires_at && new Date(payout.token_expires_at).getTime() > Date.now() && (
                      <div className="flex items-center justify-center h-7 px-2 text-[10px] font-medium bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/30">
                        <VideoUploadCountdown
                          tokenExpiresAt={payout.token_expires_at}
                          hasVideo={payout.has_video}
                          showAsFullStatus={false}
                          asButton={true}
                        />
                      </div>
                    )}

                    {/* Profit Breakdown Button - Mobile */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(payout.auction_id);
                      }}
                      className="flex items-center gap-0.5 h-7 px-2 text-[10px] font-medium bg-white/4 text-gray-300 rounded-md hover:bg-white/10 transition-colors border border-white/20"
                    >
                      <span>Details</span>
                      <svg
                        className={`w-3 h-3 transition-transform ${expandedItems.has(payout.auction_id) ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Profit Breakdown */}
              {expandedItems.has(payout.auction_id) && (
                <div className={`mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10 rounded-b-lg ${
                  !payout.payout_unlocked ? 'bg-gray-900/90 -mx-3 md:-mx-4 -mb-3 md:-mb-4 px-3 md:px-4 pb-3 md:pb-4' : ''
                }`}>
                  <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-white">Winning Bid</span>
                      <span className="text-white font-medium">{formatCurrency(payout.winning_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-[10px] md:text-sm">Service Cost</span>
                      <span className="text-gray-400">-{formatCurrency(payout.start_price)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 md:pt-2 border-t border-white/5">
                      <span className="text-white font-medium">Profit</span>
                      <span className="text-white font-medium">{formatCurrency(payout.profit_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-[10px] md:text-sm">Platform Fee (25%)</span>
                      <span className="text-gray-400">-{formatCurrency(payout.platform_fee_amount)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 md:pt-2 border-t border-white/5">
                      <span className="text-green-400 font-semibold">Your Payout</span>
                      <span className="text-green-400 font-bold">{formatCurrency(payout.model_amount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tooltip overlay for checkbox (only for locked cards) - Desktop only */}
            {!payout.payout_unlocked && (
              <div className="hidden md:flex absolute left-4 top-0 h-full items-center z-10">
                <div className="relative group">
                  <div className="w-4 h-4 cursor-not-allowed" />
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-0 bg-gray-800 text-amber-400 text-xs px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none">
                    Watch Video to Unlock
                  </div>
                </div>
              </div>
            )}

            {/* Overlay Layer - Full opacity buttons (only for locked cards) - Desktop only */}
            {!payout.payout_unlocked && (
              <div className="hidden md:flex absolute top-4 right-0 pr-4 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  {/* Watch Video Button or Countdown */}
                  {payout.has_video && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchVideo(payout.auction_id, payout.auction_title);
                      }}
                      className="flex items-center justify-center h-8 px-3 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/30 flex-shrink-0 min-w-[110px]"
                    >
                      Watch Video
                    </button>
                  )}
                  {!payout.has_video && payout.token_expires_at && new Date(payout.token_expires_at).getTime() > Date.now() && (
                    <div className="flex items-center justify-center h-8 px-3 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/30 flex-shrink-0 min-w-[110px]">
                      <VideoUploadCountdown
                        tokenExpiresAt={payout.token_expires_at}
                        hasVideo={payout.has_video}
                        showAsFullStatus={false}
                        asButton={true}
                      />
                    </div>
                  )}

                  {/* Profit Breakdown Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(payout.auction_id);
                    }}
                    className="flex items-center gap-1 h-8 px-3 text-xs font-medium bg-white/4 text-gray-300 rounded-lg hover:bg-white/10 transition-colors border border-white/20 flex-shrink-0"
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
            )}

            {/* Buttons for unlocked cards (normal flow) - Desktop only */}
            {payout.payout_unlocked && (
              <div className="hidden md:flex absolute top-4 right-0 pr-4">
                <div className="flex items-center gap-2">
                  {/* Profit Breakdown Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(payout.auction_id);
                    }}
                    className="flex items-center gap-1 h-8 px-3 text-xs font-medium bg-white/4 text-gray-300 rounded-lg hover:bg-white/10 transition-colors border border-white/20 flex-shrink-0"
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
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
