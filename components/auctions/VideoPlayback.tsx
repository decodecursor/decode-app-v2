/**
 * Video Playback Component
 * Allows auction creators to view winner videos
 * Requires watching to completion to unlock payout
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isVideoExpired } from '@/lib/models/AuctionVideo.model';
import type { AuctionVideo } from '@/lib/models/AuctionVideo.model';

interface VideoPlaybackProps {
  auctionId: string;
  className?: string;
  onPayoutUnlocked?: () => void;
}

export function VideoPlayback({ auctionId, className = '', onPayoutUnlocked }: VideoPlaybackProps) {
  const [video, setVideo] = useState<AuctionVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  // Tracking for seeking prevention
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAllowedTimeRef = useRef(0);

  useEffect(() => {
    fetchVideo();
  }, [auctionId]);

  const fetchVideo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/auctions/${auctionId}/video/view`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError('No video has been uploaded for this auction yet.');
        } else {
          throw new Error(data.error || 'Failed to load video');
        }
        return;
      }

      setVideo(data.video);
      // If already watched, show unlock success state
      if (data.video?.payout_unlocked_at) {
        setUnlockSuccess(true);
      }
    } catch (err) {
      console.error('Error fetching video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent seeking forward - only allow watching sequentially
  const handleSeeking = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // If trying to seek ahead of what's been watched, reset to last allowed position
    if (videoEl.currentTime > lastAllowedTimeRef.current + 0.5) {
      videoEl.currentTime = lastAllowedTimeRef.current;
    }
  }, []);

  // Track progress - update furthest watched position
  const handleTimeUpdate = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Update last allowed time to furthest position reached
    if (videoEl.currentTime > lastAllowedTimeRef.current) {
      lastAllowedTimeRef.current = videoEl.currentTime;
    }
  }, []);

  // Handle video ended - unlock payout
  const handleEnded = useCallback(async () => {
    // Don't call API if already unlocked
    if (video?.payout_unlocked_at || unlockSuccess) return;

    setIsUnlocking(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/video/watched`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUnlockSuccess(true);
        // Update video state with new unlock info
        setVideo(prev => prev ? {
          ...prev,
          watched_to_end_at: data.watched_at,
          payout_unlocked_at: data.payout_unlocked_at,
        } : null);
        onPayoutUnlocked?.();
      } else {
        console.error('Failed to mark video as watched:', data.error);
      }
    } catch (err) {
      console.error('Error marking video as watched:', err);
    } finally {
      setIsUnlocking(false);
    }
  }, [auctionId, video?.payout_unlocked_at, unlockSuccess, onPayoutUnlocked]);

  // Handle play button click - start video and hide overlay
  const handlePlayClick = useCallback(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      setHasStartedPlaying(true);
      videoEl.play();
    }
  }, []);

  if (isLoading) {
    return <VideoPlaybackSkeleton />;
  }

  if (error) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-8 text-center ${className}`}>
        <svg
          className="mx-auto w-12 h-12 text-gray-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <p className="text-base sm:text-lg font-medium text-gray-600 mb-2">Waiting for Winner to upload Video</p>
        <p className="text-xs sm:text-sm text-gray-600">Video will appear here once uploaded</p>
      </div>
    );
  }

  if (!video || !video.file_url) {
    return null;
  }

  const expired = isVideoExpired(video);
  const daysUntilExpiry = Math.ceil(
    (new Date(video.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const isPayoutLocked = video?.file_url && !video?.payout_unlocked_at;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Winner's Video Message</h3>
          {!expired && daysUntilExpiry <= 3 && (
            <span className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
              Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Video Player */}
      {expired ? (
        <div className="p-8 text-center bg-gray-50">
          <svg
            className="mx-auto w-12 h-12 text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-600 font-medium">Video Expired</p>
          <p className="text-sm text-gray-500 mt-1">
            This video was automatically deleted after 7 days
          </p>
        </div>
      ) : (
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            playsInline
            className={`w-full h-full ${!hasStartedPlaying ? 'invisible' : ''}`}
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onSeeking={isPayoutLocked ? handleSeeking : undefined}
            onTimeUpdate={isPayoutLocked ? handleTimeUpdate : undefined}
            onEnded={handleEnded}
            controls
          >
            <source
              src={video.file_url}
              type={video.mime_type || 'video/webm'}
            />
            Your browser does not support video playback.
          </video>
          {/* Black overlay with play button - shown before video starts */}
          {!hasStartedPlaying && (
            <button
              onClick={handlePlayClick}
              className="absolute inset-0 bg-black flex items-center justify-center cursor-pointer group"
              aria-label="Play video"
            >
              <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center group-hover:bg-opacity-100 transition-all">
                <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>
          )}
          {isUnlocking && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-white text-center">
                <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm">Unlocking payout...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payout Message - only show when payout is locked */}
      {!expired && isPayoutLocked && (
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-medium text-amber-800">Watch this video to unlock your payout</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Video Playback Skeleton (loading state)
 */
export function VideoPlaybackSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded w-48" />
      </div>
      <div className="relative bg-gray-300 aspect-video" />
    </div>
  );
}

/**
 * Compact Video Indicator (for auction cards)
 */
export function VideoIndicator({ hasVideo, isExpired }: { hasVideo: boolean; isExpired?: boolean }) {
  if (!hasVideo) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <svg
        className={`w-4 h-4 ${isExpired ? 'text-gray-400' : 'text-blue-600'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
      </svg>
      <span className={`text-xs ${isExpired ? 'text-gray-500' : 'text-blue-600'}`}>
        {isExpired ? 'Video expired' : 'Video available'}
      </span>
    </div>
  );
}
