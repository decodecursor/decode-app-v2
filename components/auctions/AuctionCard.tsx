/**
 * Auction Card Component
 * Display auction summary with live timer and current price
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CompactAuctionTimer } from './AuctionTimer';
import { formatBidAmount } from '@/lib/models/Bid.model';
import type { Auction, AuctionWithCreator } from '@/lib/models/Auction.model';
import { isAuctionEnded } from '@/lib/models/Auction.model';
import { calculateProfit, calculatePlatformFee, calculateModelAmount } from '@/lib/models/AuctionPayout.model';
import QRCode from 'qrcode';
import { VideoPlayback } from './VideoPlayback';
import { VideoModal } from './VideoModal';
import { LinkBeautyBusinessModal } from './LinkBeautyBusinessModal';
import { VideoUploadCountdown } from './VideoUploadCountdown';

interface AuctionCardProps {
  auction: Auction | AuctionWithCreator;
  showCreator?: boolean;
}

export function AuctionCard({ auction, showCreator = false }: AuctionCardProps) {
  const router = useRouter();
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoData, setVideoData] = useState<any>(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [linkedBusiness, setLinkedBusiness] = useState<any>(auction.business || null);

  // Update linkedBusiness when auction.business changes
  useEffect(() => {
    if (auction.business) {
      setLinkedBusiness(auction.business);
    }
  }, [auction.business]);

  // Lazy load business data if linked_business_id exists but business object doesn't
  useEffect(() => {
    // Lazy load business data if not already included in auction
    if (auction.linked_business_id && !auction.business && !linkedBusiness) {
      fetch(`/api/beauty-businesses/${auction.linked_business_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.business) {
            setLinkedBusiness(data.business);
          }
        })
        .catch(() => {});
    }
  }, [auction.linked_business_id, auction.business, linkedBusiness]);

  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const hasBids = auction.total_bids > 0;

  // Type guard to check if auction has creator info
  const hasCreator = (auction: Auction | AuctionWithCreator): auction is AuctionWithCreator => {
    return 'creator' in auction;
  };

  // Check if auction is active (not ended and status is active)
  const isActive = auction.status === 'active' && !isAuctionEnded(auction);

  // Determine if deactivate button should be visible
  const shouldShowDeactivateButton = !isAuctionEnded(auction) &&
    auction.status !== 'cancelled' &&
    auction.status !== 'completed';

  // Calculate creator's profit and payout (only if there are bids)
  let creatorProfit = 0;
  if (hasBids) {
    const profit = calculateProfit(currentPrice, startPrice);
    const platformFee = calculatePlatformFee(currentPrice, startPrice);
    creatorProfit = calculateModelAmount(profit, platformFee);
  }

  // Get payout status display
  const getPayoutStatusText = () => {
    if (!auction.payout_status) return formatBidAmount(0);

    switch (auction.payout_status) {
      case 'pending':
        return formatBidAmount(0);
      case 'processing':
        return 'Processing...';
      case 'transferred':
        return formatBidAmount(creatorProfit); // Could fetch actual amount from payout table
      case 'failed':
        return 'Failed';
      default:
        return 'Not Paid';
    }
  };

  // Determine if payout requires action (show amber)
  const shouldShowAmberPayout = () => {
    const hasEnded = isAuctionEnded(auction) ||
                     auction.status === 'ended' ||
                     auction.status === 'completed';

    return hasEnded &&
           auction.total_bids > 0 &&
           creatorProfit > 0 &&
           auction.payout_status !== 'transferred';
  };

  // Handle share auction
  const handleShare = async () => {
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

  // Handle QR code generation
  const handleGenerateQR = async () => {
    try {
      setGeneratingQR(true);
      setShowQRModal(true); // Open modal immediately

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const auctionUrl = `${baseUrl}/auctions/${auction.id}`;

      // Generate QR code for auction detail page
      const qrDataURL = await QRCode.toDataURL(auctionUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataURL(qrDataURL);

      // Auto-close QR modal after 20 seconds
      setTimeout(() => {
        setShowQRModal(false);
        setQrCodeDataURL('');
      }, 20000);

    } catch (error) {
      console.error('Error generating QR code:', error);
      setShowQRModal(false);
      alert('Failed to generate QR code. Please try again.');
    } finally {
      setGeneratingQR(false);
    }
  };

  // Handle deactivate auction (uses cancel endpoint)
  const handleDeactivate = async () => {
    try {
      setDeactivating(true);

      const response = await fetch(`/api/auctions/${auction.id}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel auction');
      }

      // Refresh the page to show updated status
      window.location.reload();

    } catch (error) {
      console.error('Error cancelling auction:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel auction. Please try again.');
    } finally {
      setDeactivating(false);
      setShowDeactivateConfirm(false);
    }
  };

  // Fetch video data on mount and when has_video flag changes
  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoadingVideo(true);
        const response = await fetch(`/api/auctions/${auction.id}/video/view`);

        if (response.ok) {
          const data = await response.json();
          setVideoData(data.video || null);
        } else {
          setVideoData(null);
        }
      } catch (error) {
        console.error('Error fetching video:', error);
        setVideoData(null);
      } finally {
        setLoadingVideo(false);
      }
    };

    fetchVideo();
  }, [auction.id, auction.has_video]); // React to has_video changes from real-time updates

  const closeQRModal = () => {
    setShowQRModal(false);
    setQrCodeDataURL('');
  };

  // Card colors based on status
  const getCardColors = () => {
    // Check cancelled status FIRST
    if (auction.status === 'cancelled') {
      return {
        stripe: 'border-l-red-500',
        hover: 'hover:border-red-400',
        bg: 'bg-red-900/30'
      };
    }

    // Check if auction has ended
    const hasEnded = isAuctionEnded(auction) || auction.status === 'ended' || auction.status === 'completed';

    if (hasEnded) {
      // If auction has bids, COMPLETED (green)
      if (auction.total_bids > 0) {
        return {
          stripe: 'border-l-green-500',
          hover: 'hover:border-green-400',
          bg: 'bg-green-900/30'
        };
      }
      // If no bids, ENDED (gray)
      return {
        stripe: 'border-l-gray-500',
        hover: 'hover:border-gray-400',
        bg: 'bg-gray-900/30'
      };
    }

    // Active (LIVE) - PURPLE exception
    if (auction.status === 'active') {
      return {
        stripe: 'border-l-purple-500',
        hover: 'hover:border-purple-400',
        bg: 'bg-gray-900/80'
      };
    }

    // Pending/Upcoming (blue)
    if (auction.status === 'pending') {
      return {
        stripe: 'border-l-blue-500',
        hover: 'hover:border-blue-400',
        bg: 'bg-blue-900/30'
      };
    }

    // Default fallback
    return {
      stripe: 'border-l-gray-500',
      hover: 'hover:border-gray-400',
      bg: 'bg-blue-900/30'
    };
  };

  const cardColors = getCardColors();

  // Status badge with glassmorphism design - 15% smaller on mobile
  const getStatusBadge = () => {
    // Check cancelled status FIRST (before time-based checks)
    if (auction.status === 'cancelled') {
      return (
        <span className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium text-red-500 bg-gray-900/80 backdrop-blur-md rounded-full border-2 border-red-500 flex items-center gap-1 md:gap-1.5">
          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Cancelled
        </span>
      );
    }

    // Check if auction has ended (by time or status)
    const hasEnded = isAuctionEnded(auction) || auction.status === 'ended' || auction.status === 'completed';

    if (hasEnded) {
      // If auction has bids, show COMPLETED (green)
      if (auction.total_bids > 0) {
        return (
          <span className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium text-green-500 bg-gray-900/80 backdrop-blur-md rounded-full border-2 border-green-500 flex items-center gap-1 md:gap-1.5">
            <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Completed
          </span>
        );
      }
      // If no bids, show ENDED (gray)
      return (
        <span className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium text-gray-500 bg-gray-900/80 backdrop-blur-md rounded-full border-2 border-gray-500 flex items-center gap-1 md:gap-1.5">
          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
          Ended
        </span>
      );
    }

    switch (auction.status) {
      case 'active':
        return (
          <span className="px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium text-purple-500 bg-gray-900/80 backdrop-blur-md rounded-full border-2 border-purple-500 flex items-center gap-1 md:gap-1.5 animate-pulse">
            <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-purple-500"></span>
            </span>
            Live
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium text-blue-500 bg-gray-900/80 backdrop-blur-md rounded-full border-2 border-blue-500 flex items-center gap-1 md:gap-1.5">
            <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upcoming
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className={`relative overflow-hidden border border-gray-600 border-l-4 rounded-lg shadow-lg transition-all duration-200 ${cardColors.bg} ${cardColors.stripe} ${cardColors.hover}`}>
      <Link href={`/auctions/${auction.id}`}>
        <div className="p-5 cursor-pointer">
        {/* Header */}
        <div className="border-b border-gray-700 pb-4 mb-4 overflow-hidden">
          {/* Mobile Layout: Title row, then Avatars row, then Status row */}
          {/* Desktop Layout: All in one row with absolute positioned avatars */}

          {/* Row 1: Title + Status Badge (Mobile) / Title + Avatars + Status (Desktop) */}
          <div className="relative flex items-center gap-2 md:gap-3">
            {/* Left: Title */}
            <div className="flex-1 min-w-0 md:pr-20">
              <h3 className="text-base md:text-[26px] font-semibold text-white truncate">
                {auction.title}
              </h3>
            </div>

            {/* Center: Model & Business Images - Hidden on mobile, shown on desktop */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center">
              {/* Model Image */}
              <div className="instagram-avatar" style={{ width: '54px', height: '54px' }}>
                {hasCreator(auction) && auction.creator.profile_photo_url ? (
                  <img
                    src={auction.creator.profile_photo_url}
                    alt={auction.creator.user_name || 'Model'}
                  />
                ) : (
                  <div className="avatar-fallback">
                    <span className="text-white text-lg font-bold">
                      {hasCreator(auction) && auction.creator.user_name ? auction.creator.user_name.charAt(0).toUpperCase() : 'M'}
                    </span>
                  </div>
                )}
              </div>

              {/* Beauty Business Image */}
              {linkedBusiness ? (
                <div className="relative z-10 -ml-[10px] group">
                  <div
                    className="instagram-avatar cursor-pointer"
                    style={{ width: '54px', height: '54px' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowBusinessModal(true);
                    }}
                    role="button"
                    aria-label="Manage beauty business link"
                  >
                    {linkedBusiness.business_photo_url ? (
                      <img
                        src={linkedBusiness.business_photo_url}
                        alt={linkedBusiness.business_name || 'Beauty Business'}
                      />
                    ) : (
                      <div className="avatar-fallback bg-gray-500">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Hover Tooltip */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <span className="text-white bg-black/80 px-2 py-1 rounded" style={{ fontSize: '10px' }}>
                      {linkedBusiness.business_name || 'Manage Beauty Business'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 -ml-[10px] group">
                  <div
                    className="relative w-[54px] h-[54px] rounded-full overflow-hidden border-2 border-dashed border-amber-500/30 cursor-pointer transition-all duration-200 hover:scale-110 hover:brightness-110"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowBusinessModal(true);
                    }}
                    role="button"
                    aria-label="Link beauty business"
                  >
                    <div className="w-full h-full bg-amber-500/10 flex items-center justify-center opacity-75">
                      <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  {/* Hover Tooltip */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <span className="text-white bg-black/80 px-2 py-1 rounded" style={{ fontSize: '10px' }}>
                      Connect Beauty Business
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Timer & Status Badge */}
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {auction.status === 'active' && !isAuctionEnded(auction) && (
                <CompactAuctionTimer auction={auction} />
              )}
              {getStatusBadge()}
            </div>
          </div>

          {/* Row 2: Avatars - Mobile only, left-aligned below title */}
          <div className="flex md:hidden items-center justify-start mt-3 gap-0">
            {/* Model Image */}
            <div className="instagram-avatar" style={{ width: '44px', height: '44px' }}>
              {hasCreator(auction) && auction.creator.profile_photo_url ? (
                <img
                  src={auction.creator.profile_photo_url}
                  alt={auction.creator.user_name || 'Model'}
                />
              ) : (
                <div className="avatar-fallback">
                  <span className="text-white text-sm font-bold">
                    {hasCreator(auction) && auction.creator.user_name ? auction.creator.user_name.charAt(0).toUpperCase() : 'M'}
                  </span>
                </div>
              )}
            </div>

            {/* Beauty Business Image - Always use instagram-avatar style on mobile */}
            <div className="relative z-10 -ml-[8px]">
              <div
                className="instagram-avatar cursor-pointer"
                style={{ width: '44px', height: '44px' }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBusinessModal(true);
                }}
                role="button"
                aria-label={linkedBusiness ? "Manage beauty business link" : "Link beauty business"}
              >
                {linkedBusiness?.business_photo_url ? (
                  <img
                    src={linkedBusiness.business_photo_url}
                    alt={linkedBusiness.business_name || 'Beauty Business'}
                  />
                ) : (
                  <div className="avatar-fallback bg-gray-500">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description on second row if exists */}
          {auction.description && (
            <p className="mt-2 text-xs md:text-sm text-gray-300 line-clamp-2">
              {auction.description}
            </p>
          )}
        </div>

        {/* Pricing Stats */}
        <div className="mb-2 overflow-hidden">
          {/* Mobile: Starting Price left, Profit+Payout right / Desktop: Full row */}
          <div className="flex justify-between items-start gap-2 md:gap-3">
            {/* Starting Price / Current Bid / Winning Bid */}
            <div>
              <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide">
                {(() => {
                  // Use same ended check as status badge for consistency
                  const hasEnded = isAuctionEnded(auction) ||
                                   auction.status === 'ended' ||
                                   auction.status === 'completed';

                  if (hasEnded && auction.total_bids > 0) {
                    return 'Winning Bid';
                  } else if (hasBids) {
                    return 'Current Bid';
                  } else {
                    return 'Starting Price';
                  }
                })()}
              </p>
              <p className="text-sm md:text-xl font-bold text-white">
                {formatBidAmount(hasBids ? currentPrice : startPrice)}
              </p>
            </div>

            {/* My Profit + My Payout together on mobile */}
            <div className="flex gap-3 md:gap-6 items-start">
              {/* My Profit */}
              <div className="text-right">
                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide">My Profit</p>
                <p className="text-sm md:text-xl font-bold text-white">
                  {formatBidAmount(creatorProfit)}
                </p>
              </div>

              {/* My Payout */}
              <div className="text-right relative group">
                <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wide">My Payout</p>
                <p
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push('/dashboard/payouts');
                  }}
                  className={`text-sm md:text-xl font-bold cursor-pointer hover:scale-110 transition-all duration-200 ${
                    shouldShowAmberPayout()
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-white hover:text-purple-300'
                  }`}
                >
                  {getPayoutStatusText()}
                </p>
                {/* Hover Tooltip - Desktop only */}
                <div className="hidden md:block absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  <span className="text-white bg-black/80 px-2 py-1 rounded text-xs">
                    Request Payout
                  </span>
                </div>
              </div>
            </div>

            {/* Bids + Bidders - Desktop only */}
            <div className="hidden md:flex gap-6 text-right">
              {/* Bid Count */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Bids</p>
                <p className="text-xl font-bold text-white">
                  {auction.total_bids}
                </p>
              </div>

              {/* Bidder Count */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Bidders</p>
                <p className="text-xl font-bold text-white">
                  {auction.unique_bidders}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>

        {/* Action Buttons Row */}
        <div className="border-t border-gray-700 pt-2 px-2 pb-2 overflow-hidden">
          {/* All buttons inline on one row */}
          <div className="flex flex-wrap gap-1.5 md:gap-2 items-center">
            {/* Video Section - Inline with other buttons */}
            {!loadingVideo && (
              <>
                {videoData?.file_url ? (
                  // State 2: Video uploaded - show clickable "View Video" button
                  <button
                    onClick={() => {
                      setShowVideoModal(true);
                    }}
                    className="cosmic-button-secondary text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 transition-all rounded-lg flex items-center gap-1 md:gap-1.5 border-white/30 hover:bg-white/10"
                    title="View video"
                  >
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden md:inline">View Video</span>
                    <span className="md:hidden">Video</span>
                  </button>
                ) : (
                  // State 1 or 3: Waiting for upload or expired - compact inline button
                  <VideoUploadCountdown
                    tokenExpiresAt={videoData?.token_expires_at || null}
                    hasVideo={false}
                    showAsFullStatus={true}
                    auctionEnded={isAuctionEnded(auction)}
                    compactMobile={true}
                  />
                )}
              </>
            )}

            {/* Share + QR Code buttons - inline with video */}
            <div className="flex flex-wrap gap-1.5 md:gap-2 md:ml-auto">
              {/* Share Button */}
              <button
              onClick={handleShare}
              className={`cosmic-button-secondary text-xs md:text-sm px-3 py-1.5 transition-all border border-white/30 rounded-lg hover:bg-white/10 flex items-center gap-1.5 ${
                shareSuccess ? 'bg-green-500/20 text-green-300 border-green-500' : ''
              }`}
              title="Share auction"
            >
              {shareSuccess ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share</span>
                </>
              )}
            </button>

            {/* QR Code Button */}
            <button
              onClick={handleGenerateQR}
              disabled={generatingQR}
              className="cosmic-button-secondary text-xs md:text-sm px-3 py-1.5 transition-all border border-white/30 rounded-lg hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate QR code"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>{generatingQR ? 'Generating...' : 'QR Code'}</span>
            </button>

            {/* Deactivate Button */}
            {shouldShowDeactivateButton && (
              <button
                onClick={() => setShowDeactivateConfirm(true)}
                disabled={deactivating}
                className="cosmic-button-secondary text-xs md:text-sm px-3 py-1.5 transition-all border border-white/30 rounded-lg hover:bg-red-500/20 hover:border-red-500 hover:text-red-300 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Deactivate auction"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>{deactivating ? 'Deactivating...' : 'Deactivate'}</span>
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

    {/* QR Code Modal - Using Portal to bypass backdrop-filter containment */}
    {showQRModal && typeof window !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="cosmic-card max-w-md w-full text-center">
          <div className="flex justify-end mb-4">
            <button
              onClick={closeQRModal}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-white font-medium mb-6">Scan to View Auction</p>

          {generatingQR ? (
            <div className="mb-6 flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
            </div>
          ) : qrCodeDataURL ? (
            <div className="mb-6">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img
                  src={qrCodeDataURL}
                  alt="Auction QR Code"
                  className="w-64 h-64 mx-auto"
                />
              </div>
            </div>
          ) : (
            <p className="text-red-400 mb-6">Failed to generate QR code</p>
          )}

          <div className="mb-6">
            <p className="text-white text-xl font-semibold">{auction.title}</p>
          </div>

          <button
            onClick={closeQRModal}
            className="cosmic-button-primary w-full py-3"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    )}

    {/* Deactivate Confirmation Modal - Using Portal to bypass backdrop-filter containment */}
    {showDeactivateConfirm && typeof window !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
        onClick={() => setShowDeactivateConfirm(false)}
      >
        <div
          className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">Deactivate Auction?</h3>
          <p className="text-gray-300 mb-6">
            Are you sure you want to deactivate this auction? This action will prevent new bids.
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeactivateConfirm(false)}
              disabled={deactivating}
              className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Beauty Business Link Modal */}
    <LinkBeautyBusinessModal
      isOpen={showBusinessModal}
      onClose={() => setShowBusinessModal(false)}
      linkedBusinessId={linkedBusiness?.id || auction.linked_business_id || null}
      onLink={async (businessId) => {
        try {
          // Call API to link business to auction
          const response = await fetch(`/api/auctions/${auction.id}/link-business`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linked_business_id: businessId }),
          });

          const result = await response.json();

          if (result.success) {
            setLinkedBusiness(businessId);
            console.log('Business linked successfully:', businessId);
            // Refresh page to show updated auction with linked business
            window.location.reload();
          } else {
            console.error('Failed to link business:', result.error);
            alert('Failed to link business. Please try again.');
          }
        } catch (error) {
          console.error('Error linking business:', error);
          alert('Failed to link business. Please try again.');
        }
      }}
    />

    {/* Video Modal */}
    <VideoModal
      isOpen={showVideoModal}
      onClose={() => setShowVideoModal(false)}
      auctionId={auction.id}
      auctionTitle={auction.title}
    />
  </>
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
