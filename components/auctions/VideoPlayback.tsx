/**
 * Video Playback Component
 * Allows auction creators to view winner videos
 */

'use client';

import React, { useState, useEffect } from 'react';
import { formatVideoSize, formatVideoDuration, isVideoExpired } from '@/lib/models/AuctionVideo.model';
import type { AuctionVideo } from '@/lib/models/AuctionVideo.model';

interface VideoPlaybackProps {
  auctionId: string;
  className?: string;
}

export function VideoPlayback({ auctionId, className = '' }: VideoPlaybackProps) {
  const [video, setVideo] = useState<AuctionVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Error fetching video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <VideoPlaybackSkeleton />;
  }

  if (error) {
    return (
      <div className={`bg-blue-50 border border-blue-200 rounded-lg p-8 text-center ${className}`}>
        <svg
          className="mx-auto w-12 h-12 text-blue-500 mb-3"
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
        <p className="text-lg font-medium text-blue-900 mb-2">Waiting for Winner to Upload Video</p>
        <p className="text-sm text-blue-700">Recording link has been sent to the winner. The video will appear here once uploaded.</p>
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
            src={video.file_url}
            controls
            playsInline
            className="w-full h-full"
            controlsList="nodownload"
          >
            Your browser does not support video playback.
          </video>
        </div>
      )}

      {/* Video Info */}
      {!expired && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase">Duration</p>
              <p className="text-sm font-medium text-gray-900">
                {formatVideoDuration(video.duration_seconds)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Size</p>
              <p className="text-sm font-medium text-gray-900">
                {formatVideoSize(video.file_size_bytes)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Uploaded</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(video.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {video.retake_count > 0 && (
            <div className="mt-3 p-2 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-700 text-center">
                Winner used {video.retake_count} retake{video.retake_count !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!expired && (
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={() => window.open(video.file_url, '_blank')}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Open in New Tab
          </button>
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
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-3 bg-gray-200 rounded w-16 mx-auto mb-2" />
              <div className="h-4 bg-gray-200 rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
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
