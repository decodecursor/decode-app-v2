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
}

/**
 * Map color state to Tailwind CSS classes
 */
const COLOR_CLASS_MAP = {
  normal: 'text-gray-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
} as const;

export function VideoUploadCountdown({ tokenExpiresAt, hasVideo }: VideoUploadCountdownProps) {
  const { formatted, colorState, shouldShow } = useVideoUploadTimer(tokenExpiresAt, hasVideo);

  // Don't render if conditions not met
  if (!shouldShow) {
    return null;
  }

  const colorClass = COLOR_CLASS_MAP[colorState];

  return (
    <div className="flex items-center gap-1.5 px-1">
      {/* Clock Icon - Same as CompactAuctionTimer */}
      <svg
        className={`w-[18px] h-[18px] ${colorClass}`}
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
      <span className={`text-sm font-mono tabular-nums ${colorClass}`}>
        {formatted} remaining
      </span>
    </div>
  );
}
