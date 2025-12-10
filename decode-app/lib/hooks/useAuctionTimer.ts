/**
 * useAuctionTimer Hook
 * React hook for live auction countdown timer with anti-sniping detection
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getTimeRemaining, formatTimeRemaining } from '@/lib/models/Auction.model';
import type { Auction } from '@/lib/models/Auction.model';

interface TimerState {
  timeRemaining: number; // milliseconds
  formatted: string; // "5h 23m 15s"
  isEnding: boolean; // less than 5 minutes
  isCritical: boolean; // less than 1 minute
  hasEnded: boolean;
  endTime: Date;
  wasExtended: boolean; // anti-sniping triggered
}

export function useAuctionTimer(auction: Auction | null) {
  const [timerState, setTimerState] = useState<TimerState>(() => {
    if (!auction) {
      return {
        timeRemaining: 0,
        formatted: 'Ended',
        isEnding: false,
        isCritical: false,
        hasEnded: true,
        endTime: new Date(),
        wasExtended: false,
      };
    }

    const endTime = new Date(auction.end_time);
    const timeRemaining = getTimeRemaining(auction.end_time);

    return {
      timeRemaining,
      formatted: formatTimeRemaining(timeRemaining),
      isEnding: timeRemaining > 0 && timeRemaining <= 5 * 60 * 1000,
      isCritical: timeRemaining > 0 && timeRemaining <= 60 * 1000,
      hasEnded: timeRemaining <= 0,
      endTime,
      wasExtended: false,
    };
  });

  // Use useRef instead of useState to avoid triggering re-renders
  // This value is only used to detect anti-sniping time extensions
  const previousEndTimeRef = useRef<number>(
    auction ? new Date(auction.end_time).getTime() : 0
  );

  // Update timer every second
  useEffect(() => {
    if (!auction || auction.status === 'ended' || auction.status === 'completed') {
      setTimerState((prev) => ({
        ...prev,
        hasEnded: true,
        timeRemaining: 0,
        formatted: 'Ended',
      }));
      return;
    }

    const updateTimer = () => {
      const endTime = new Date(auction.end_time);
      const endTimeMs = endTime.getTime();
      const timeRemaining = getTimeRemaining(auction.end_time);

      // Check if time was extended (anti-sniping)
      const wasExtended = previousEndTimeRef.current > 0 && endTimeMs > previousEndTimeRef.current;
      if (wasExtended) {
        previousEndTimeRef.current = endTimeMs;
      }

      setTimerState({
        timeRemaining,
        formatted: formatTimeRemaining(timeRemaining),
        isEnding: timeRemaining > 0 && timeRemaining <= 5 * 60 * 1000,
        isCritical: timeRemaining > 0 && timeRemaining <= 60 * 1000,
        hasEnded: timeRemaining <= 0,
        endTime,
        wasExtended,
      });
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [auction?.id, auction?.status, auction?.end_time]); // Use primitives, not object reference - prevents re-render loops

  // Update previous end time when auction changes
  useEffect(() => {
    if (auction) {
      previousEndTimeRef.current = new Date(auction.end_time).getTime();
    }
  }, [auction?.end_time]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate progress percentage (0-100)
  const getProgress = useCallback((): number => {
    if (!auction) return 100;

    const startTime = new Date(auction.start_time).getTime();
    const endTime = new Date(auction.end_time).getTime();
    const now = Date.now();

    const totalDuration = endTime - startTime;
    const elapsed = now - startTime;

    if (elapsed >= totalDuration) return 100;
    if (elapsed <= 0) return 0;

    return Math.min(100, (elapsed / totalDuration) * 100);
  }, [auction?.start_time, auction?.end_time]);

  // Get time remaining in specific units
  const getTimeUnits = useCallback((): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } => {
    if (timerState.timeRemaining <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const totalSeconds = Math.floor(timerState.timeRemaining / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const days = Math.floor(totalSeconds / 86400);

    return { days, hours, minutes, seconds };
  }, [timerState.timeRemaining]);

  return {
    ...timerState,
    progress: getProgress(),
    timeUnits: getTimeUnits(),
  };
}

/**
 * useAuctionNotifications Hook
 * Handle timer-based notifications
 */
export function useAuctionNotifications(
  auction: Auction | null,
  onNotification?: (message: string, type: 'info' | 'warning' | 'success') => void
) {
  const { timeRemaining, isEnding, isCritical, hasEnded, wasExtended } = useAuctionTimer(auction);

  // Track notification states
  const [notified5Min, setNotified5Min] = useState(false);
  const [notified1Min, setNotified1Min] = useState(false);
  const [notifiedEnded, setNotifiedEnded] = useState(false);

  useEffect(() => {
    if (!auction || !onNotification) return;

    // 5 minute warning
    if (isEnding && !notified5Min && timeRemaining <= 5 * 60 * 1000 && timeRemaining > 4 * 60 * 1000) {
      onNotification('Auction ending in 5 minutes!', 'warning');
      setNotified5Min(true);
    }

    // 1 minute warning
    if (isCritical && !notified1Min && timeRemaining <= 60 * 1000 && timeRemaining > 50 * 1000) {
      onNotification('Auction ending in 1 minute!', 'warning');
      setNotified1Min(true);
    }

    // Auction ended
    if (hasEnded && !notifiedEnded) {
      onNotification('Auction has ended!', 'info');
      setNotifiedEnded(true);
    }

    // Time extended (anti-sniping)
    if (wasExtended) {
      onNotification('Time extended by 60 seconds due to late bid!', 'info');
    }
  }, [
    auction,
    isEnding,
    isCritical,
    hasEnded,
    wasExtended,
    timeRemaining,
    onNotification,
    notified5Min,
    notified1Min,
    notifiedEnded,
  ]);

  // Reset notifications when auction changes
  useEffect(() => {
    setNotified5Min(false);
    setNotified1Min(false);
    setNotifiedEnded(false);
  }, [auction?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
