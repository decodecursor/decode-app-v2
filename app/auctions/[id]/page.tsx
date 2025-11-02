/**
 * Individual Auction Page
 * Shows auction details with live bidding and leaderboard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuctionRealtime } from '@/lib/hooks/useAuctionRealtime';
import { useBidNotifications, useWinnerNotification } from '@/lib/hooks/useBidNotifications';
import { AuctionTimer } from '@/components/auctions/AuctionTimer';
import { LiveLeaderboard } from '@/components/auctions/LiveLeaderboard';
import { BiddingInterface } from '@/components/auctions/BiddingInterface';
import { WinnerNotification } from '@/components/auctions/WinnerNotification';
import { VideoPlayback } from '@/components/auctions/VideoPlayback';
import { formatBidAmount } from '@/lib/models/Bid.model';
import { createClient } from '@/lib/supabase/client';

export default function AuctionDetailPage() {
  const params = useParams();
  const auctionId = params.id as string;

  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const [isCreator, setIsCreator] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  const { auction, isConnected, refresh } = useAuctionRealtime(auctionId);

  // Check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
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
    if (auction && userEmail) {
      setIsCreator(auction.creator?.email === userEmail);
    }
  }, [auction, userEmail]);

  // Winner notification
  const { hasWon, recordingToken, winningAmount } = useWinnerNotification(
    auction,
    userEmail,
    () => setShowWinnerModal(true)
  );

  // Bid notifications (toast notifications would be handled by parent layout)
  useBidNotifications(auction, userEmail);

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
          <div className="flex items-center gap-4 mb-4">
            <a
              href="/auctions"
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
              Back to Auctions
            </a>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{auction.title}</h1>
              {auction.description && (
                <p className="text-gray-600 text-lg">{auction.description}</p>
              )}

              {/* Creator Info */}
              {auction.creator && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-700">
                      {auction.creator.full_name?.[0] || auction.creator.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {auction.creator.full_name || auction.creator.email}
                    </p>
                    <p className="text-xs text-gray-500">Auction Creator</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div>
              {auction.status === 'active' ? (
                <span className="px-4 py-2 text-sm font-semibold text-green-700 bg-green-100 rounded-full">
                  Live Auction
                </span>
              ) : auction.status === 'ended' || auction.status === 'completed' ? (
                <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-full">
                  Auction Ended
                </span>
              ) : (
                <span className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-100 rounded-full">
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
            {/* Timer & Price Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Price */}
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">
                    {hasBids ? 'Current Bid' : 'Starting Price'}
                  </p>
                  <p className="text-4xl font-bold text-gray-900">
                    {formatBidAmount(hasBids ? currentPrice : startPrice)}
                  </p>
                  {hasBids && (
                    <p className="mt-2 text-sm text-gray-600">
                      {auction.total_bids} bid{auction.total_bids !== 1 ? 's' : ''} •{' '}
                      {auction.unique_bidders} bidder{auction.unique_bidders !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Timer */}
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">
                    Time Remaining
                  </p>
                  <AuctionTimer auction={auction} showProgress />
                </div>
              </div>

              {/* Connection Status */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-gray-600">
                      {isConnected ? 'Live updates active' : 'Connecting...'}
                    </span>
                  </div>
                  <button
                    onClick={refresh}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Bidding Interface */}
            {!isCreator && auction.status === 'active' && (
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
                  <dt className="text-gray-600">Starting Price</dt>
                  <dd className="font-medium text-gray-900">{formatBidAmount(startPrice)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Duration</dt>
                  <dd className="font-medium text-gray-900">{auction.duration} minutes</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Started</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(auction.start_time).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Ends</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(auction.end_time).toLocaleString()}
                  </dd>
                </div>
                {auction.winner_name && (
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <dt className="text-gray-600">Winner</dt>
                    <dd className="font-medium text-green-700">{auction.winner_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Right Column - Leaderboard */}
          <div className="lg:col-span-1">
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
    </div>
  );
}
