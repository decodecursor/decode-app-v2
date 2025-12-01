/**
 * useVideoUploadTimer Hook
 * React hook for video upload deadline countdown (24-hour window after auction ends)
 * USES token_expires_at FROM DATABASE AS SINGLE SOURCE OF TRUTH
 */

'use client';

import { useEffect, useState } from 'react';

type ColorState = 'normal' | 'warning' | 'critical';

interface VideoUploadTimerState {
  timeRemaining: number; // milliseconds until deadline
  formatted: string; // "23h 45m" | "45m" | "5m 30s" | "30s"
  colorState: ColorState;
  shouldShow: boolean; // false if expired or video exists
  deadline: Date;
}

/**
 * Format time remaining into human-readable string
 * @param ms - Milliseconds remaining
 * @returns Formatted string like "23h 45m", "45m", "5m 30s", "5s"
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  // >1hr: "Xh Xm"
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  // >1min: "Xm" or "Xm Xs" if <10min
  if (minutes > 0) {
    if (minutes >= 10) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }

  // ≤1min: "Xs"
  return `${seconds}s`;
}

/**
 * Get color state based on time remaining
 * @param ms - Milliseconds remaining
 * @returns Color state: normal (>6hr), warning (6hr-2hr), critical (<2hr)
 */
function getColorState(ms: number): ColorState {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  if (ms < TWO_HOURS) return 'critical';
  if (ms < SIX_HOURS) return 'warning';
  return 'normal';
}

/**
 * Custom hook for managing video upload countdown timer
 * @param tokenExpiresAt - ISO timestamp from auction_videos.token_expires_at (single source of truth)
 * @param hasVideo - Whether video has been uploaded
 * @returns Timer state with formatted time, color, and visibility
 */
export function useVideoUploadTimer(
  tokenExpiresAt: string | null,
  hasVideo: boolean
): VideoUploadTimerState {
  // Calculate initial state
  const [timerState, setTimerState] = useState<VideoUploadTimerState>(() => {
    if (!tokenExpiresAt) {
      return {
        timeRemaining: 0,
        formatted: '0s',
        colorState: 'normal',
        shouldShow: false,
        deadline: new Date(),
      };
    }

    // Use database timestamp as single source of truth
    const deadline = new Date(tokenExpiresAt);
    const now = Date.now();
    const timeRemaining = Math.max(0, deadline.getTime() - now);

    // Determine if we should show the countdown
    const notExpired = timeRemaining > 0;
    const shouldShow = !hasVideo && notExpired;

    return {
      timeRemaining,
      formatted: formatTimeRemaining(timeRemaining),
      colorState: getColorState(timeRemaining),
      shouldShow,
      deadline,
    };
  });

  // Update timer every second
  useEffect(() => {
    if (!tokenExpiresAt || !timerState.shouldShow) {
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const deadlineMs = timerState.deadline.getTime();
      const timeRemaining = Math.max(0, deadlineMs - now);

      // Check visibility conditions
      const notExpired = timeRemaining > 0;
      const shouldShow = !hasVideo && notExpired;

      setTimerState({
        timeRemaining,
        formatted: formatTimeRemaining(timeRemaining),
        colorState: getColorState(timeRemaining),
        shouldShow,
        deadline: timerState.deadline,
      });
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [tokenExpiresAt, hasVideo, timerState.deadline]);

  // Update state when tokenExpiresAt or hasVideo changes
  useEffect(() => {
    if (!tokenExpiresAt) {
      setTimerState({
        timeRemaining: 0,
        formatted: '0s',
        colorState: 'normal',
        shouldShow: false,
        deadline: new Date(),
      });
      return;
    }

    // Use database timestamp - DO NOT calculate
    const deadline = new Date(tokenExpiresAt);
    const now = Date.now();
    const timeRemaining = Math.max(0, deadline.getTime() - now);

    const notExpired = timeRemaining > 0;
    const shouldShow = !hasVideo && notExpired;

    setTimerState({
      timeRemaining,
      formatted: formatTimeRemaining(timeRemaining),
      colorState: getColorState(timeRemaining),
      shouldShow,
      deadline,
    });
  }, [tokenExpiresAt, hasVideo]);

  return timerState;
}
