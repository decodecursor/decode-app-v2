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
        <p className="text-gray-300 text-center py-8 text-xs md:text-sm">No pending payouts yet. <br />Your pending payouts will appear here.</p>
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
              {/* Mobile: Two rows stacked / Desktop: Single horizontal row */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                {/* Row 1 on mobile: Checkbox + Title + Date */}
                <div className="flex flex-row items-center gap-2 md:gap-4 w-full md:w-auto">
                  {/* Checkbox */}
                  <div className="flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedAuctionIds.has(payout.auction_id)}
                      disabled={!payout.payout_unlocked}
                      readOnly
                      className="w-6 h-6 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 pointer-events-none disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Title + Date container */}
                  <div className="flex flex-row items-center justify-between gap-2 flex-1 min-w-0 md:contents">
                    {/* Title */}
                    <div className="md:w-40 md:flex-none">
                      <p className="font-semibold text-white text-[15px] md:text-base truncate">
                        {payout.auction_title}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="md:w-28 md:order-3">
                      <p className="text-xs md:text-sm text-white">
                        {formatDate(payout.ended_at)}
                      </p>
                    </div>
                  </div>

                  {/* Amount - desktop only (via order-2) */}
                  <div className="hidden md:block md:w-36 md:order-2">
                    <p className="text-sm md:text-base font-bold text-green-400">
                      {formatCurrency(payout.model_amount)}
                    </p>
                  </div>
                </div>

                {/* Row 2 on mobile: Amount + Buttons */}
                <div className="flex flex-row items-center justify-between gap-2 w-full md:w-auto md:flex-1">
                  {/* Amount - mobile only */}
                  <div className="md:hidden">
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(payout.model_amount)}
                    </p>
                  </div>

                  {/* Desktop spacer */}
                  <div className="hidden md:flex md:flex-1"></div>

                  {/* Buttons group - right aligned on mobile, desktop uses invisible placeholders */}
                  <div className="flex items-center gap-1.5 md:ml-0 md:invisible">
                  {/* Watch Video Button or Countdown - Only for locked cards */}
                  {!payout.payout_unlocked && payout.has_video && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchVideo(payout.auction_id, payout.auction_title);
                      }}
                      className="flex items-center justify-center h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs font-medium bg-amber-500/10 md:bg-amber-500/20 text-amber-400 rounded-md md:rounded-lg hover:bg-amber-500/30 transition-colors border border-amber-500/30 flex-shrink-0 md:min-w-[110px]"
                    >
                      Watch Video
                    </button>
                  )}
                  {!payout.payout_unlocked && !payout.has_video && payout.token_expires_at && new Date(payout.token_expires_at).getTime() > Date.now() && (
                    <div className="flex items-center justify-center h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs font-medium bg-amber-500/10 md:bg-amber-500/20 text-amber-400 rounded-md md:rounded-lg border border-amber-500/30 flex-shrink-0 md:min-w-[110px]">
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
                    className="flex items-center gap-0.5 md:gap-1 h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs font-medium bg-white/4 md:bg-white/2 text-gray-300 rounded-md md:rounded-lg hover:bg-white/10 transition-colors border border-white/20 md:border-white/10 flex-shrink-0"
                  >
                    <span className="md:inline">Details</span>
                    <span className="hidden md:inline">Profit Breakdown</span>
                    <svg
                      className={`w-3 h-3 md:w-4 md:h-4 transition-transform ${expandedItems.has(payout.auction_id) ? 'rotate-180' : ''}`}
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
                      <span className="text-gray-400 text-[8px] md:text-sm">Auction Starting Price (Beauty Service Price)</span>
                      <span className="text-gray-400 text-[10px] md:text-xs">-{formatCurrency(payout.start_price)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 md:pt-2 border-t border-white/5">
                      <span className="text-white font-medium">Profit</span>
                      <span className="text-white font-medium">{formatCurrency(payout.profit_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-[8px] md:text-sm">DECODE Service Fee (25% of Profit)</span>
                      <span className="text-gray-400 text-[10px] md:text-xs">-{formatCurrency(payout.platform_fee_amount)}</span>
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
