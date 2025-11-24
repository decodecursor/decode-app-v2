/**
 * Auction Card Component
 * Display auction summary with live timer and current price
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CompactAuctionTimer } from './AuctionTimer';
import { formatBidAmount } from '@/lib/models/Bid.model';
import type { Auction, AuctionWithCreator } from '@/lib/models/Auction.model';
import { isAuctionEnded } from '@/lib/models/Auction.model';
import { calculateProfit, calculatePlatformFee, calculateModelAmount } from '@/lib/models/AuctionPayout.model';
import QRCode from 'qrcode';
import { VideoPlayback } from './VideoPlayback';
import { LinkBeautyBusinessModal } from './LinkBeautyBusinessModal';

interface AuctionCardProps {
  auction: Auction | AuctionWithCreator;
  showCreator?: boolean;
}

export function AuctionCard({ auction, showCreator = false }: AuctionCardProps) {
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [videoData, setVideoData] = useState<any>(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [linkedBusiness, setLinkedBusiness] = useState<string | null>(null);

  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const hasBids = auction.total_bids > 0;

  // Type guard to check if auction has creator info
  const hasCreator = (auction: Auction | AuctionWithCreator): auction is AuctionWithCreator => {
    return 'creator' in auction;
  };

  // Check if auction is active (not ended and status is active)
  const isActive = auction.status === 'active' && !isAuctionEnded(auction);

  // Calculate creator's profit and payout (only if there are bids)
  let creatorProfit = 0;
  if (hasBids) {
    const profit = calculateProfit(currentPrice, startPrice);
    const platformFee = calculatePlatformFee(currentPrice, startPrice);
    creatorProfit = calculateModelAmount(currentPrice, platformFee);
  }

  // Get payout status display
  const getPayoutStatusText = () => {
    if (!auction.payout_status) return 'Not Paid';

    switch (auction.payout_status) {
      case 'pending':
        return 'Not Paid';
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

  // Handle QR code generation
  const handleGenerateQR = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setGeneratingQR(true);

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const auctionUrl = `${baseUrl}/auctions/${auction.id}`;

      // Create WhatsApp share URL
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(auctionUrl)}`;
      const qrDataURL = await QRCode.toDataURL(whatsappUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataURL(qrDataURL);
      setShowQRModal(true);

      // Auto-close QR modal after 20 seconds
      setTimeout(() => {
        setShowQRModal(false);
        setQrCodeDataURL('');
      }, 20000);

    } catch (error) {
      console.error('Error generating QR code:', error);
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

  // Fetch video data on mount
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
  }, [auction.id]);

  const closeQRModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowQRModal(false);
    setQrCodeDataURL('');
  };

  // Status badge
  const getStatusBadge = () => {
    // Check cancelled status FIRST (before time-based checks)
    if (auction.status === 'cancelled') {
      return (
        <span className="px-2 py-1 text-xs font-medium text-red-400 bg-red-900/20 rounded-full">
          Cancelled
        </span>
      );
    }

    // Check actual end time (for auctions that ended by time)
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
    <>
      <Link href={`/auctions/${auction.id}`}>
        <div className={`relative overflow-hidden border border-gray-600 border-l-4 rounded-lg shadow-lg p-5 transition-all duration-200 cursor-pointer
          ${isActive
            ? 'bg-gray-900/80 border-l-purple-500 hover:border-purple-400'
            : 'bg-blue-900/30 border-l-gray-500 hover:border-gray-400'
          }`}
        >
          {/* Status Overlay for Ended/Deactivated */}
          {(isAuctionEnded(auction) || auction.status === 'cancelled') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <span
                className={`text-4xl md:text-6xl font-black uppercase tracking-wider rotate-[-15deg] ${
                  auction.status === 'cancelled' ? 'text-red-400 opacity-30' : 'text-white/30'
                }`}
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
              >
                {auction.status === 'cancelled' ? 'CANCELLED' : 'ENDED'}
              </span>
            </div>
          )}

        {/* Header */}
        <div className="border-b border-gray-700 pb-4 mb-4">
          <div className="flex items-center gap-3">
            {/* Left: Title */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">
                {auction.title}
              </h3>
            </div>

            {/* Center: Model & Business Images */}
            <div className="flex items-center relative">
              {/* Model Image */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 opacity-75 blur-sm"></div>
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/30">
                  {hasCreator(auction) && auction.creator.profile_photo_url ? (
                    <img
                      src={auction.creator.profile_photo_url}
                      alt={auction.creator.user_name || 'Model'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">
                        {hasCreator(auction) && auction.creator.user_name ? auction.creator.user_name.charAt(0).toUpperCase() : 'M'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Beauty Business Image */}
              {linkedBusiness ? (
                <div
                  className="relative z-10 -ml-3 w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 cursor-pointer transition-all duration-200 hover:scale-110 hover:brightness-110"
                  onClick={() => setShowBusinessModal(true)}
                  role="button"
                  aria-label="Manage beauty business link"
                >
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              ) : (
                <div
                  className="relative z-10 -ml-3 w-12 h-12 rounded-full overflow-hidden border-2 border-dashed border-gray-600 cursor-pointer transition-all duration-200 hover:scale-110 hover:brightness-110"
                  onClick={() => setShowBusinessModal(true)}
                  role="button"
                  aria-label="Link beauty business"
                >
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center opacity-50">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Timer & Status Badge */}
            <div className="flex-1 flex items-center gap-2 justify-end">
              {auction.status === 'active' && !isAuctionEnded(auction) && (
                <CompactAuctionTimer auction={auction} />
              )}
              {getStatusBadge()}
            </div>
          </div>

          {/* Description on second row if exists */}
          {auction.description && (
            <p className="mt-2 text-sm text-gray-300 line-clamp-2">
              {auction.description}
            </p>
          )}
        </div>

        {/* Pricing Stats */}
        <div className="mb-4">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            {/* LEFT GROUP: Starting Price */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                {isAuctionEnded(auction) && auction.winner_name
                  ? 'Winning Bid'
                  : hasBids
                  ? 'Current Bid'
                  : 'Starting Price'}
              </p>
              <p className="mt-1 text-xl md:text-2xl font-bold text-white">
                {formatBidAmount(hasBids ? currentPrice : startPrice)}
              </p>
            </div>

            {/* MIDDLE GROUP: My Profit + My Payout */}
            <div className="flex gap-6 md:gap-8">
              {/* My Profit */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">My Profit</p>
                <p className="mt-1 text-xl md:text-2xl font-bold text-white">
                  {formatBidAmount(creatorProfit)}
                </p>
              </div>

              {/* My Payout */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">My Payout</p>
                <p className="mt-1 text-xl md:text-2xl font-bold text-white">
                  {getPayoutStatusText()}
                </p>
              </div>
            </div>

            {/* RIGHT GROUP: Bids + Bidders */}
            <div className="flex gap-6 md:gap-8">
              {/* Bid Count */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Bids</p>
                <p className="mt-1 text-xl md:text-2xl font-bold text-white">
                  {auction.total_bids}
                </p>
              </div>

              {/* Bidder Count */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Bidders</p>
                <p className="mt-1 text-xl md:text-2xl font-bold text-white">
                  {auction.unique_bidders}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="border-t border-gray-700 pt-4">
          <div className="flex flex-wrap gap-2 justify-between items-start">
            {/* Video Button - Left aligned */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (videoData) {
                  setVideoExpanded(!videoExpanded);
                }
              }}
              disabled={!videoData || loadingVideo}
              className={`cosmic-button-secondary text-xs md:text-sm px-3 py-2 transition-all border rounded-lg flex items-center gap-1.5 ${
                videoData
                  ? 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10'
                  : 'border-white/20 text-gray-500 opacity-50 cursor-not-allowed'
              }`}
              title={videoData ? 'View video' : 'No video uploaded yet'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{videoData ? (videoExpanded ? 'Hide Video' : 'View Video') : 'No Video Yet'}</span>
            </button>

            {/* Right side buttons group */}
            <div className="flex flex-wrap gap-2">
              {/* Share Button */}
              <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleShare(e);
              }}
              className={`cosmic-button-secondary text-xs md:text-sm px-3 py-2 transition-all border border-white/30 rounded-lg hover:bg-white/10 flex items-center gap-1.5 ${
                shareSuccess ? 'bg-green-500/20 text-green-300 border-green-500' : ''
              }`}
              title="Share auction"
            >
              {shareSuccess ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Shared!</span>
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleGenerateQR(e);
              }}
              disabled={generatingQR}
              className="cosmic-button-secondary text-xs md:text-sm px-3 py-2 transition-all border border-white/30 rounded-lg hover:bg-white/10 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate QR code"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>{generatingQR ? 'Generating...' : 'QR Code'}</span>
            </button>

            {/* Deactivate Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeactivateConfirm(true);
              }}
              disabled={deactivating}
              className="cosmic-button-secondary text-xs md:text-sm px-3 py-2 transition-all border border-white/30 rounded-lg hover:bg-red-500/20 hover:border-red-500 hover:text-red-300 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Deactivate auction"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>{deactivating ? 'Deactivating...' : 'Deactivate'}</span>
            </button>
            </div>
          </div>
        </div>

        {/* Inline Video Expansion */}
        {videoExpanded && videoData && (
          <div className="border-t border-gray-700 pt-4 mt-4 transition-all duration-300 ease-in-out">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-white">Auction Video</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setVideoExpanded(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close video"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <VideoPlayback auctionId={auction.id} />
            </div>
          </div>
        )}

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

    {/* QR Code Modal */}
    {showQRModal && (
      <div
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
        onClick={closeQRModal}
      >
        <div
          className="bg-white rounded-lg p-6 max-w-sm w-full"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Share Auction</h3>
            <button
              onClick={closeQRModal}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col items-center">
            <img src={qrCodeDataURL} alt="QR Code" className="w-64 h-64 mb-4" />
            <p className="text-sm text-gray-600 text-center">
              Scan this QR code to share via WhatsApp
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Deactivate Confirmation Modal */}
    {showDeactivateConfirm && (
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
      </div>
    )}

    {/* Beauty Business Link Modal */}
    <LinkBeautyBusinessModal
      isOpen={showBusinessModal}
      onClose={() => setShowBusinessModal(false)}
      onLink={(businessId) => {
        setLinkedBusiness(businessId);
        console.log('Linked business:', businessId);
      }}
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
