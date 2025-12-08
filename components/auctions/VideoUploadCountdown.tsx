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
  auctionEnded?: boolean; // If true, auction has ended (used to determine if "No Video" should show)
  compactMobile?: boolean; // If true, show compact version on mobile (camera icon + time only)
}

/**
 * Map color state to Tailwind CSS classes
 */
const COLOR_CLASS_MAP = {
  normal: 'text-gray-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
} as const;

export function VideoUploadCountdown({ tokenExpiresAt, hasVideo, showAsFullStatus = false, asButton = false, auctionEnded = false, compactMobile = false }: VideoUploadCountdownProps) {
  // If showing full status and no token exists (no video record yet)
  if (showAsFullStatus && !tokenExpiresAt && !hasVideo) {
    // Only show "No Video" if auction has ended (waiting for video session creation)
    // During live auction, return null to hide this section
    if (!auctionEnded) {
      return null;
    }

    // Compact inline button style matching Share/QR Code buttons
    return (
      <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm text-gray-400 border-0 rounded-lg" style={{ border: 'none' }}>
        <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>No Video</span>
      </div>
    );
  }

  const { formatted, colorState, shouldShow, isExpired } = useVideoUploadTimer(tokenExpiresAt, hasVideo);

  const colorClass = 'text-amber-400'; // Always amber for video upload countdown

  // Handle expired state when showing full status
  if (showAsFullStatus && isExpired) {
    // Compact inline button style matching Share/QR Code buttons
    return (
      <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm text-gray-400 border-0 rounded-lg" style={{ border: 'none' }}>
        {/* Camera Icon */}
        <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span className="hidden md:inline">No Video Uploaded</span>
        <span className="md:hidden">No Video</span>
      </div>
    );
  }

  // Don't render if conditions not met
  if (!shouldShow) {
    return null;
  }

  // Show full status row with camera icon, text, watch icon, and time
  if (showAsFullStatus) {
    // Compact mobile: only camera icon + time - styled as inline button
    if (compactMobile) {
      return (
        <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm border-0 rounded-lg">
          {/* Camera Icon */}
          <svg className={`w-3.5 h-3.5 md:w-4 md:h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>

          {/* Mobile: Just time / Desktop: Full text */}
          <span className={`md:hidden font-mono tabular-nums ${colorClass}`}>
            {formatted}
          </span>

          {/* Desktop: Full status text */}
          <span className={`hidden md:inline ${colorClass}`}>Video Upload Countdown</span>
          <svg className={`hidden md:block w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`hidden md:inline font-mono tabular-nums ${colorClass}`}>
            {formatted}
          </span>
        </div>
      );
    }

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
        className={`${asButton ? 'w-2.5 h-2.5 md:w-3.5 md:h-3.5' : 'w-[18px] h-[18px]'} ${colorClass}`}
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
      <span className={`${asButton ? 'text-[8px] md:text-xs' : 'text-sm'} font-mono tabular-nums ${colorClass}`}>
        {formatted}{!asButton && ' remaining'}
      </span>
    </div>
  );
}
