/**
 * Individual Auction Page Client Component
 * Shows auction details with live bidding and leaderboard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuctionRealtime } from '@/lib/hooks/useAuctionRealtime';
import { isAuctionEnded } from '@/lib/models/Auction.model';
import { useBidNotifications, useWinnerNotification } from '@/lib/hooks/useBidNotifications';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { AuctionTimer } from '@/components/auctions/AuctionTimer';
import { LiveLeaderboard } from '@/components/auctions/LiveLeaderboard';
import { BiddingInterface } from '@/components/auctions/BiddingInterface';
import { WinnerNotification } from '@/components/auctions/WinnerNotification';
import { VideoPlayback } from '@/components/auctions/VideoPlayback';
import { formatBidAmount } from '@/lib/models/Bid.model';
import { createClient } from '@/utils/supabase/client';

export default function AuctionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params.id as string;

  const [userId, setUserId] = useState<string | undefined>();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const [isCreator, setIsCreator] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { auction, isConnected, refresh } = useAuctionRealtime(auctionId);

  // Check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        setUserEmail(user.email);
        const { data: userData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setUserName(userData?.full_name || user.email);
      }
    };

    checkUser();
  }, []);

  // Check if current user is the creator
  useEffect(() => {
    if (auction && userId) {
      setIsCreator(auction.creator_id === userId);
    }
  }, [auction, userId]);

  // Winner notification
  const { hasWon, recordingToken, winningAmount } = useWinnerNotification(
    auction,
    userEmail,
    () => setShowWinnerModal(true)
  );

  // Bid notifications (toast notifications would be handled by parent layout)
  useBidNotifications(auction, userEmail);

  // Timer state for real-time status badge updates
  const { hasEnded: timerEnded } = useAuctionTimer(auction);

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Refresh auction data with visual feedback
  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  // Cancel auction
  const handleCancelAuction = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/cancel`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel auction');
      }

      alert('Auction cancelled successfully. All payment authorizations have been released.');
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel auction');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  const currentPrice = Number(auction.current_price);
  const startPrice = Number(auction.start_price);
  const hasBids = auction.total_bids > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isCreator && (
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-[3px] break-words">{auction.title}</h1>
              <p className="text-gray-500 text-xs sm:text-sm mb-2">
                by {(auction as any).creator?.user_name || (auction as any).creator?.email || 'Unknown Model'}
              </p>
              {auction.description && (
                <p className="text-gray-600 text-sm sm:text-lg">{auction.description}</p>
              )}
            </div>

            {/* Status Badge and Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              {/* Cancel Auction Button (only for creator of active auctions) */}
              {isCreator && auction.status !== 'cancelled' && auction.status !== 'completed' && !isAuctionEnded(auction) && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelling}
                  className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-[10px] sm:text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                title="Refresh auction data"
              >
                <svg className={`w-3 h-3 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isRefreshing ? '...' : 'Refresh'}</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-2 text-[10px] sm:text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                title="Share auction link"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Share</span>
                  </>
                )}
              </button>
              {auction.status === 'cancelled' ? (
                <span className="px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-semibold text-red-700 bg-red-100 rounded-full">
                  Cancelled
                </span>
              ) : isAuctionEnded(auction) || timerEnded ? (
                <span className="px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-semibold text-gray-700 bg-gray-100 rounded-full">
                  Ended
                </span>
              ) : auction.status === 'active' ? (
                <span className="px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-semibold text-green-700 bg-green-100 rounded-full flex items-center gap-1 sm:gap-2">
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500"></span>
                  </span>
                  <span className="hidden sm:inline">Live Auction</span>
                  <span className="sm:hidden">Live</span>
                </span>
              ) : (
                <span className="px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-sm font-semibold text-blue-700 bg-blue-100 rounded-full">
                  Upcoming
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Auction Info & Bidding */}
          <div className="lg:col-span-2 space-y-6">
            {/* Winner requirement notice */}
            <p className="text-sm text-gray-600 italic">
              Winner can record a 10sec video that I must view to unlock the funds
            </p>

            {/* Timer & Price Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {/* Current Price */}
                <div>
                  <p className="text-[10px] sm:text-sm text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">
                    {hasBids ? 'Current Bid' : 'Starting Price'}
                  </p>
                  <p className="text-2xl sm:text-4xl font-bold text-gray-900">
                    {formatBidAmount(hasBids ? currentPrice : startPrice)}
                  </p>
                </div>

                {/* Timer */}
                <div>
                  <p className="text-[10px] sm:text-sm text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">
                    Time Remaining
                  </p>
                  {auction.status === 'cancelled' ? (
                    <p className="text-lg sm:text-2xl font-bold text-red-600">Cancelled</p>
                  ) : (
                    <AuctionTimer auction={auction} showProgress />
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Leaderboard - shown only on small screens */}
            <div className="lg:hidden">
              <LiveLeaderboard auctionId={auctionId} userEmail={userEmail} />
            </div>

            {/* Bidding Interface */}
            {!isCreator && !isAuctionEnded(auction) && (
              <BiddingInterface
                auction={auction}
                userEmail={userEmail}
                userName={userName}
                onBidPlaced={refresh}
              />
            )}

            {/* Creator View - Video Playback */}
            {isCreator && (auction.status === 'ended' || auction.status === 'completed') && (
              <VideoPlayback auctionId={auctionId} />
            )}

            {/* Auction Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Auction Details</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Starting Price</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatBidAmount(startPrice)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Duration</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(() => {
                      const hours = Math.floor(auction.duration / 60);
                      const minutes = auction.duration % 60;
                      if (hours === 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                      if (minutes === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
                      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
                    })()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Started</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {new Date(auction.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(auction.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">{isAuctionEnded(auction) ? 'Ended' : 'Ends'}</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {new Date(auction.end_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(auction.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </dd>
                </div>
                {auction.winner_name && (
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <dt className="text-sm text-gray-600">Winner</dt>
                    <dd className="text-sm font-medium text-green-700">{auction.winner_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Right Column - Leaderboard (desktop only) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-4">
              <LiveLeaderboard auctionId={auctionId} userEmail={userEmail} />
            </div>
          </div>
        </div>
      </div>

      {/* Winner Notification Modal */}
      {hasWon && winningAmount && (
        <WinnerNotification
          isOpen={showWinnerModal}
          auctionTitle={auction.title}
          winningAmount={winningAmount}
          recordingToken={recordingToken || undefined}
          onClose={() => setShowWinnerModal(false)}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Auction?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this auction? All payment authorizations will be
              released and no winner will be selected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                No, Keep Auction
              </button>
              <button
                onClick={handleCancelAuction}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
