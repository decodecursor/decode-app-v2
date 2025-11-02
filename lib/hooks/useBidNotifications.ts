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
  onWin?: (recordingToken: string) => void
) {
  const [hasWon, setHasWon] = useState(false);
  const [recordingToken, setRecordingToken] = useState<string | null>(null);

  useEffect(() => {
    if (!auction || !userEmail) return;

    // Check if auction ended and user is the winner
    if (
      (auction.status === 'ended' || auction.status === 'completed') &&
      auction.winner_email === userEmail &&
      !hasWon
    ) {
      setHasWon(true);

      // Create recording session
      fetch(`/api/auctions/${auction.id}/video/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_id: auction.winner_bid_id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.session) {
            setRecordingToken(data.session.token);
            if (onWin) {
              onWin(data.session.token);
            }
          }
        })
        .catch((error) => {
          console.error('Error creating recording session:', error);
        });
    }
  }, [auction, userEmail, hasWon, onWin]);

  return {
    hasWon,
    recordingToken,
    winningAmount: hasWon && auction ? Number(auction.current_price) : null,
  };
}
