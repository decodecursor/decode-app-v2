/**
 * Individual Auction Page Client Component
 * Shows auction details with live bidding and leaderboard
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuctionRealtime } from '@/lib/hooks/useAuctionRealtime';
import { useLeaderboard } from '@/lib/hooks/useLeaderboard';
import { isAuctionEnded } from '@/lib/models/Auction.model';
import { useBidNotifications, useWinnerNotification } from '@/lib/hooks/useBidNotifications';
import { useAuctionTimer } from '@/lib/hooks/useAuctionTimer';
import { AuctionTimer } from '@/components/auctions/AuctionTimer';
import { LiveLeaderboard } from '@/components/auctions/LiveLeaderboard';
import { BiddingInterface } from '@/components/auctions/BiddingInterface';
import { WinnerNotification } from '@/components/auctions/WinnerNotification';
import { VideoPlayback } from '@/components/auctions/VideoPlayback';
import { AuctionFeeBreakdown } from '@/components/auctions/AuctionFeeBreakdown';
import { HistoricalLeaderboards } from '@/components/auctions/HistoricalLeaderboards';
import { formatBidAmount } from '@/lib/models/Bid.model';
import { createClient } from '@/utils/supabase/client';
import HeartAnimation from '@/components/effects/HeartAnimation';

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
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [guestBidId, setGuestBidId] = useState<string | null>(null);
  const [linkedBusiness, setLinkedBusiness] = useState<any>(null);

  const { auction, isConnected, error, isLoading, refresh, retry } = useAuctionRealtime(auctionId);
  const { refresh: refreshLeaderboard } = useLeaderboard(auctionId, userEmail);

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

  // Lazy load business data if linked_business_id exists
  useEffect(() => {
    if (auction?.linked_business_id && !linkedBusiness) {
      fetch(`/api/beauty-businesses/${auction.linked_business_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.business) {
            setLinkedBusiness(data.business);
          }
        })
        .catch(() => {});
    }
  }, [auction?.linked_business_id, linkedBusiness]);

  // Initialize guest bid ID from localStorage on mount
  useEffect(() => {
    if (!userEmail && typeof window !== 'undefined') {
      const storedBidId = localStorage.getItem(`guest_bid_${auctionId}`);
      if (storedBidId) {
        setGuestBidId(storedBidId);
        console.log('💾 [AuctionDetail] Restored guest bid ID from localStorage:', storedBidId);
      }
    }
  }, [auctionId, userEmail]);

  // Winner notification (supports both logged-in users and guest bidders)
  const { hasWon, recordingToken, sessionError, winningAmount } = useWinnerNotification(
    auction,
    userEmail,
    () => setShowWinnerModal(true),
    guestBidId || undefined
  );

  // Bid notifications (toast notifications would be handled by parent layout)
  useBidNotifications(auction, userEmail);

  // Timer state for real-time status badge updates
  const { hasEnded: timerEnded } = useAuctionTimer(auction);

  // Track previous timerEnded value to detect transitions
  const prevTimerEndedRef = useRef(timerEnded);

  // Trigger heart animation only when auction JUST ended (not on refresh)
  useEffect(() => {
    const prevTimerEnded = prevTimerEndedRef.current;

    // Only trigger if timer transitioned from false to true (live end event)
    // Don't trigger on mount if already ended (page refresh case)
    // Don't trigger for cancelled auctions
    // Don't trigger for auctions with no bids
    if (!prevTimerEnded && timerEnded && auction?.status !== 'cancelled' && auction.total_bids > 0) {
      setShowHeartAnimation(true);
    }

    // Update ref for next render
    prevTimerEndedRef.current = timerEnded;
  }, [timerEnded, auction]);

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

  // Refresh auction data by reloading the page (refreshes everything including video)
  const handleRefresh = () => {
    window.location.reload();
  };

  // Combined refresh for both auction and leaderboard after bid placement
  const handleBidPlaced = async (bidId?: string) => {
    console.log('💰 [AuctionDetail] Bid placed, refreshing data...');

    // Store bid ID for guest winner detection
    if (bidId && !userEmail) {
      setGuestBidId(bidId);
      // Persist to localStorage for session survival
      if (typeof window !== 'undefined') {
        localStorage.setItem(`guest_bid_${auctionId}`, bidId);
        console.log('💾 [AuctionDetail] Stored guest bid ID in localStorage:', bidId);
      }
    }

    // Immediate refresh
    await Promise.all([
      refresh(),
      refreshLeaderboard()
    ]);

    // Scroll to top of page on both mobile and desktop after bid
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Second refresh after 2 seconds to catch database updates
    // This ensures we get the updated data even if the first refresh was too quick
    setTimeout(async () => {
      console.log('💰 [AuctionDetail] Secondary refresh after bid...');
      await Promise.all([
        refresh(),
        refreshLeaderboard()
      ]);
    }, 2000);

    // Third refresh after 5 seconds as final fallback
    setTimeout(async () => {
      console.log('💰 [AuctionDetail] Final refresh after bid...');
      await refreshLeaderboard();
    }, 5000);
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

      setCancelSuccess(true);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel auction');
      setShowCancelConfirm(false);
    } finally {
      setIsCancelling(false);
    }
  };

  // Error State - Show error UI with retry
  if (error && !auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error.statusCode === 404 ? 'Auction Not Found' : 'Failed to Load Auction'}
          </h1>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={retry}
              className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again
            </button>
            <a
              href="/auctions"
              className="w-full px-6 py-3 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50 block"
            >
              Back to Auctions
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Loading State - Only show when actively loading and no auction data yet
  if (isLoading && !auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading auction...</p>
        </div>
      </div>
    );
  }

  // Fallback - No auction and no error/loading (edge case)
  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No auction data available</p>
          <button
            onClick={retry}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const hasBids = auction.total_bids > 0;

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundColor: '#F9FAFB'
      }}
    >
      {/* Background layer with opacity */}
      <div
        className="absolute inset-0 pointer-events-none auction-detail-bg"
        style={{
          backgroundImage: 'url(/Pattern.jpeg)',
          backgroundPosition: 'top left',
          backgroundRepeat: 'repeat',
          opacity: 0.5,
          zIndex: 1
        }}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200" style={{ position: 'relative', zIndex: 10 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Desktop-only: Top row with Back button (left) and Action buttons (right) */}
          <div className="hidden sm:flex items-center mb-4">
            {/* Left: Back button */}
            {isCreator && (
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-[3px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
            {/* Right: Action buttons */}
            <div className="flex flex-nowrap items-center gap-1 sm:gap-3 ml-auto">
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
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-600">Copied!</span>
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
              {!isAuctionEnded(auction) && !timerEnded && auction.status !== 'cancelled' && (
                auction.status === 'active' ? (
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
                )
              )}
            </div>
          </div>

          {/* Mobile-only: Top row with Back button (left) and Action buttons (right) */}
          <div className="flex sm:hidden items-center mb-4">
            {/* Left: Back button */}
            {isCreator && (
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-[3px]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>
            )}
            {/* Right: Action buttons */}
            <div className="flex flex-nowrap items-center gap-1 ml-auto">
              {/* Cancel Auction Button (only for creator of active auctions) */}
              {isCreator && auction.status !== 'cancelled' && auction.status !== 'completed' && !isAuctionEnded(auction) && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelling}
                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                title="Refresh auction data"
              >
                <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isRefreshing ? '...' : 'Refresh'}</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                title="Share auction link"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Share</span>
                  </>
                )}
              </button>
              {!isAuctionEnded(auction) && !timerEnded && auction.status !== 'cancelled' && (
                auction.status === 'active' ? (
                  <span className="px-2 py-1 text-[10px] font-semibold text-green-700 bg-green-100 rounded-full flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                    </span>
                    <span className="sm:hidden">Live</span>
                  </span>
                ) : (
                  <span className="px-2 py-1 text-[10px] font-semibold text-blue-700 bg-blue-100 rounded-full">
                    Upcoming
                  </span>
                )
              )}
            </div>
          </div>

          {/* Conditional layout: Dual-avatar if business linked, single-avatar otherwise */}
          {linkedBusiness ? (
            /* DUAL-AVATAR LAYOUT - When beauty business is linked */
            <div className="flex items-center justify-between gap-3">
              {/* Left Avatar - Model */}
              <div className="flex-shrink-0">
                {(auction as any).creator?.instagram_handle ? (
                  <a
                    href={`https://instagram.com/${(auction as any).creator.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="instagram-avatar"
                  >
                    {(auction as any).creator?.profile_photo_url ? (
                      <img
                        src={(auction as any).creator.profile_photo_url}
                        alt={(auction as any).creator.user_name || 'Creator'}
                      />
                    ) : (
                      <div className="avatar-fallback">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </a>
                ) : (
                  <div className="instagram-avatar">
                    {(auction as any).creator?.profile_photo_url ? (
                      <img
                        src={(auction as any).creator.profile_photo_url}
                        alt={(auction as any).creator.user_name || 'Creator'}
                      />
                    ) : (
                      <div className="avatar-fallback">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Center Text - Responsive sizing based on text length */}
              <div className="flex-1 text-center min-w-0 px-1 flex flex-col">
                <h1 className={`font-normal text-gray-500 break-words mb-0 order-2 sm:order-1 ${
                  auction.title.length > 20 ? 'text-[14px] sm:text-[24px]' :
                  auction.title.length > 15 ? 'text-[14px] sm:text-[30px]' :
                  'text-[14px] sm:text-[36px]'
                }`}>
                  {auction.title}
                </h1>
                <p className={`text-gray-900 font-bold mt-0 order-1 sm:order-2 ${
                  ((auction as any).creator?.user_name || (auction as any).creator?.email || '').length > 25
                    ? 'text-[22px] sm:text-[16px]'
                    : 'text-[22px] sm:text-[18px]'
                }`}>
                  {(auction as any).creator?.user_name || (auction as any).creator?.email || 'Unknown Model'}
                </p>
                <p className={`text-gray-900 font-bold mt-0 order-3 ${
                  (linkedBusiness.business_name || '').length > 25
                    ? 'text-[22px] sm:text-[16px]'
                    : 'text-[22px] sm:text-[18px]'
                }`}>
                  {linkedBusiness.business_name}
                </p>
              </div>

              {/* Right Avatar - Beauty Business */}
              <div className="flex-shrink-0">
                {linkedBusiness?.instagram_handle ? (
                  <a
                    href={`https://instagram.com/${linkedBusiness.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="instagram-avatar"
                  >
                    {linkedBusiness?.business_photo_url ? (
                      <img
                        src={linkedBusiness.business_photo_url}
                        alt={linkedBusiness.business_name}
                      />
                    ) : (
                      <div className="avatar-fallback">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                  </a>
                ) : (
                  <div className="instagram-avatar">
                    {linkedBusiness?.business_photo_url ? (
                      <img
                        src={linkedBusiness.business_photo_url}
                        alt={linkedBusiness.business_name}
                      />
                    ) : (
                      <div className="avatar-fallback">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SINGLE-AVATAR LAYOUT - Default when no business linked */
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Creator Profile Image */}
                <div className="flex-shrink-0">
                  {(auction as any).creator?.instagram_handle ? (
                    <a
                      href={`https://instagram.com/${(auction as any).creator.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="instagram-avatar"
                    >
                      {(auction as any).creator?.profile_photo_url ? (
                        <img
                          src={(auction as any).creator.profile_photo_url}
                          alt={(auction as any).creator.user_name || 'Creator'}
                        />
                      ) : (
                        <div className="avatar-fallback">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </a>
                  ) : (
                    <div className="instagram-avatar">
                      {(auction as any).creator?.profile_photo_url ? (
                        <img
                          src={(auction as any).creator.profile_photo_url}
                          alt={(auction as any).creator.user_name || 'Creator'}
                        />
                      ) : (
                        <div className="avatar-fallback">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Title and Creator Name */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-[26px] sm:text-[36px] font-bold text-gray-900 break-words mb-0">{auction.title}</h1>
                  <p className="text-gray-500 text-[14px] sm:text-[18px] mt-0">
                    for {(auction as any).creator?.user_name || (auction as any).creator?.email || 'Unknown Model'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {auction.description && (
            <p className="text-gray-600 text-sm sm:text-lg mt-3">{auction.description}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ position: 'relative', zIndex: 10 }}>
        <div id="auction-content-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Auction Info & Bidding */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer & Price Card */}
            <div id="auction-timer" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {/* Current Price */}
                <div>
                  <p className="text-[10px] sm:text-sm text-gray-500 uppercase tracking-wide mb-1 sm:mb-2">
                    {isAuctionEnded(auction) || timerEnded
                      ? (hasBids ? 'Winning Bid' : 'Starting Price')
                      : (hasBids ? 'Current Bid' : 'Starting Price')
                    }
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
                    <p className="text-[17px] sm:text-[32px] font-bold text-red-600">Auction Cancelled</p>
                  ) : (
                    <AuctionTimer auction={auction} showProgress />
                  )}
                </div>
              </div>
            </div>

            {/* Fee Breakdown - Only visible to MODEL creator */}
            {isCreator && hasBids && (
              <AuctionFeeBreakdown
                auctionStartPrice={startPrice}
                currentBid={currentPrice}
                serviceName={auction.title}
                isCompleted={isAuctionEnded(auction) || timerEnded}
                className="mb-6"
              />
            )}

            {/* Mobile Leaderboard - shown only on small screens */}
            <div id="mobile-leaderboard" className="lg:hidden">
              <LiveLeaderboard auctionId={auctionId} userEmail={userEmail} isAuctionEnded={isAuctionEnded(auction) || timerEnded} isCreator={isCreator} />
            </div>

            {/* Bidding Interface */}
            {!isCreator && !isAuctionEnded(auction) && (
              <BiddingInterface
                auction={auction}
                userEmail={userEmail}
                userName={userName}
                onBidPlaced={handleBidPlaced}
              />
            )}

            {/* Creator View - Video Playback */}
            {isCreator && (isAuctionEnded(auction) || timerEnded) && (
              <VideoPlayback auctionId={auctionId} auction={auction} />
            )}

            {/* Auction Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Auction Details</h3>
              <dl className="space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Starting Price</dt>
                  <dd className="text-sm text-gray-600">{formatBidAmount(startPrice)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Duration</dt>
                  <dd className="text-sm text-gray-600">
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
                  <dd className="text-sm text-gray-600">
                    {new Date(auction.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(auction.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">{isAuctionEnded(auction) ? 'Ended' : 'Ends'}</dt>
                  <dd className="text-sm text-gray-600">
                    {new Date(auction.end_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(auction.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </dd>
                </div>
                {auction.winner_name && (
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <dt className="text-sm text-gray-600">Winner</dt>
                    <dd className="text-sm text-gray-600">{auction.winner_name}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Historical Leaderboards */}
            <HistoricalLeaderboards creatorId={auction.creator_id} currentAuctionId={auctionId} />
          </div>

          {/* Right Column - Leaderboard (desktop only) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-4">
              <LiveLeaderboard auctionId={auctionId} userEmail={userEmail} isAuctionEnded={isAuctionEnded(auction) || timerEnded} isCreator={isCreator} />
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
          error={sessionError}
          onClose={() => setShowWinnerModal(false)}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            {cancelSuccess ? (
              <>
                <div className="text-center">
                  <svg className="mx-auto w-12 h-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Auction Cancelled</h3>
                  <p className="text-gray-600 mb-6">
                    Payment authorizations released
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelSuccess(false);
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  OK
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Auction</h3>
                <p className="text-gray-600 mb-6">
                  All payment authorizations will be released and auction ends without a winner.
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Heart Animation on Auction End */}
      <HeartAnimation isActive={showHeartAnimation} targetElementId="auction-content-grid" />
    </div>
  );
}
