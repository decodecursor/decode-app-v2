/**
 * useBidNotifications Hook
 * React hook for handling bid-related notifications (outbid, new highest bid, etc.)
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { getBidBroadcaster, type BidNotification } from '@/lib/realtime/BidBroadcaster';
import type { Auction } from '@/lib/models/Auction.model';
import { formatBidAmount } from '@/lib/models/Bid.model';

export type NotificationHandler = (notification: {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  action?: {
    label: string;
    onClick: () => void;
  };
}) => void;

export function useBidNotifications(
  auction: Auction | null,
  userEmail?: string,
  onNotification?: NotificationHandler
) {
  const [notifications, setNotifications] = useState<BidNotification[]>([]);
  const [isListening, setIsListening] = useState(false);

  // Handle bid notification
  const handleNotification = useCallback(
    (notification: BidNotification) => {
      // Add to notifications list
      setNotifications((prev) => [...prev, notification]);

      // Call external notification handler
      if (onNotification) {
        switch (notification.type) {
          case 'outbid':
            onNotification({
              title: "You've been outbid!",
              message: `${notification.bidder_name} bid ${formatBidAmount(
                notification.current_highest_bid!
              )} on "${notification.auction_title}". Your bid was ${formatBidAmount(
                notification.your_bid_amount!
              )}.`,
              type: 'warning',
              action: {
                label: 'Place Higher Bid',
                onClick: () => {
                  // Navigate to auction or open bid modal
                  window.location.href = `/auctions/${notification.auction_id}`;
                },
              },
            });
            break;

          case 'new_highest_bid':
            onNotification({
              title: 'New highest bid!',
              message: `${notification.bidder_name} bid ${formatBidAmount(
                notification.current_highest_bid!
              )} on "${notification.auction_title}".`,
              type: 'info',
            });
            break;

          case 'time_extended':
            onNotification({
              title: 'Auction time extended!',
              message: `"${notification.auction_title}" has been extended by 60 seconds due to a late bid.`,
              type: 'info',
            });
            break;

          case 'auction_ending_soon':
            onNotification({
              title: 'Auction ending soon!',
              message: `"${notification.auction_title}" is ending in less than 5 minutes!`,
              type: 'warning',
              action: {
                label: 'View Auction',
                onClick: () => {
                  window.location.href = `/auctions/${notification.auction_id}`;
                },
              },
            });
            break;
        }
      }
    },
    [onNotification]
  );

  useEffect(() => {
    if (!auction) return;

    const broadcaster = getBidBroadcaster();

    // Register notification callback
    const unsubscribeNotifications = broadcaster.onNotification(handleNotification);

    // Start broadcasting for this auction
    const unsubscribeBroadcasting = broadcaster.startBroadcasting(
      auction.id,
      auction,
      userEmail
    );

    setIsListening(true);

    // Cleanup
    return () => {
      unsubscribeNotifications();
      unsubscribeBroadcasting();
      setIsListening(false);
    };
  }, [auction, userEmail, handleNotification]);

  // Track user's bid
  const trackBid = useCallback(
    (amount: number) => {
      if (auction) {
        const broadcaster = getBidBroadcaster();
        broadcaster.trackUserBid(auction.id, amount);
      }
    },
    [auction]
  );

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Get unread count
  const unreadCount = notifications.length;

  // Get latest notification
  const latestNotification = notifications[notifications.length - 1] || null;

  return {
    notifications,
    unreadCount,
    latestNotification,
    isListening,
    trackBid,
    clearNotifications,
  };
}

/**
 * useWinnerNotification Hook
 * Special hook for detecting if the current user won the auction
 */
export function useWinnerNotification(
  auction: Auction | null,
  userEmail?: string,
  onWin?: (recordingToken: string) => void,
  guestBidId?: string
) {
  const [hasWon, setHasWon] = useState(false);
  const [recordingToken, setRecordingToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!auction) return;

    // Check if user is the winner (either by email OR by bid ID for guests)
    const isWinner =
      (userEmail && auction.winner_email === userEmail) ||
      (guestBidId && auction.winner_bid_id === guestBidId);

    if (!isWinner) return;

    // Check if auction ended and user is the winner
    if (
      (auction.status === 'ended' || auction.status === 'completed') &&
      !hasWon
    ) {
      setHasWon(true);

      // Fetch recording session (GET instead of POST to retrieve existing session)
      const bidIdParam = guestBidId || auction.winner_bid_id;
      fetch(`/api/auctions/${auction.id}/video/session?bid_id=${bidIdParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.session) {
            // SUCCESS - Clear any previous errors
            setSessionError(null);
            setRecordingToken(data.session.token);
            if (onWin) {
              onWin(data.session.token);
            }
            // Auto-redirect winner to video recording page
            // Clear localStorage for guest bidders
            if (guestBidId && typeof window !== 'undefined') {
              localStorage.removeItem(`guest_bid_${auction.id}`);
              console.log('🧹 [WinnerNotification] Cleared guest bid ID from localStorage');
            }
            window.location.href = `/auctions/video/${data.session.token}`;
          } else {
            // FAILURE - Set error state
            const errorMsg = data.error || 'Unable to fetch recording session';
            setSessionError(errorMsg);
            console.error('Failed to get recording session:', errorMsg);
          }
        })
        .catch((error) => {
          // NETWORK ERROR - Set error state
          const errorMsg = 'Network error - please try again';
          setSessionError(errorMsg);
          console.error('Error fetching recording session:', error);
        });
    }
  }, [auction, userEmail, guestBidId, hasWon, onWin]);

  return {
    hasWon,
    recordingToken,
    sessionError,
    winningAmount: hasWon && auction ? Number(auction.auction_current_price) : null,
  };
}
