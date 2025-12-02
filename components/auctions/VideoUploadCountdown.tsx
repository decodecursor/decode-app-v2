/**
 * VideoUploadCountdown Component
 * Displays countdown timer for 24-hour video upload window after auction ends
 * USES token_expires_at FROM DATABASE AS SINGLE SOURCE OF TRUTH
 */

'use client';

import { useVideoUploadTimer } from '@/lib/hooks/useVideoUploadTimer';

interface VideoUploadCountdownProps {
  tokenExpiresAt: string | null; // From auction_videos.token_expires_at
  hasVideo: boolean;
  showAsFullStatus?: boolean; // If true, show full status row with camera icon and text
  asButton?: boolean; // If true, format for button display (no "remaining" text)
}

/**
 * Map color state to Tailwind CSS classes
 */
const COLOR_CLASS_MAP = {
  normal: 'text-gray-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
} as const;

export function VideoUploadCountdown({ tokenExpiresAt, hasVideo, showAsFullStatus = false, asButton = false }: VideoUploadCountdownProps) {
  const { formatted, colorState, shouldShow, isExpired } = useVideoUploadTimer(tokenExpiresAt, hasVideo);

  const colorClass = 'text-amber-400'; // Always amber for video upload countdown

  // Handle expired state when showing full status
  if (showAsFullStatus && isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400">
        {/* Camera Icon */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>No Video Uploaded</span>
      </div>
    );
  }

  // Don't render if conditions not met
  if (!shouldShow) {
    return null;
  }

  // Show full status row with camera icon, text, watch icon, and time
  if (showAsFullStatus) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
        {/* Camera Icon */}
        <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>

        {/* Status Text */}
        <span className={colorClass}>Video Upload Countdown</span>

        {/* Clock/Watch Icon */}
        <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        {/* Time Remaining */}
        <span className={`font-mono tabular-nums ${colorClass}`}>
          {formatted}
        </span>
      </div>
    );
  }

  // Compact view - adjust based on context
  return (
    <div className={`flex items-center ${asButton ? 'justify-center gap-1.5' : 'gap-1.5 px-1'}`}>
      {/* Clock Icon */}
      <svg
        className={`${asButton ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      {/* Countdown Text */}
      <span className={`${asButton ? 'text-sm' : 'text-sm'} font-mono tabular-nums ${colorClass}`}>
        {formatted}{!asButton && ' remaining'}
      </span>
    </div>
  );
}
