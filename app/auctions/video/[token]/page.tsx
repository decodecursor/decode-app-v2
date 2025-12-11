/**
 * Video Recording Page (Email Link Fallback)
 * Secure page for winners to record video via email link
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoRecorder } from '@/components/auctions/VideoRecorder';
import { VideoUploadCountdown } from '@/components/auctions/VideoUploadCountdown';

export default function VideoRecordingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [bidId, setBidId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  // Monitor token expiration in real-time
  useEffect(() => {
    if (!tokenExpiresAt) return;

    const checkExpiry = () => {
      const expired = new Date(tokenExpiresAt) < new Date();
      setIsExpired(expired);
      if (expired) {
        setError('This link has expired. The 24-hour recording window has closed.');
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);

    return () => clearInterval(interval);
  }, [tokenExpiresAt]);

  const validateToken = async () => {
    try {
      setIsValidating(true);
      setError(null);

      const response = await fetch('/api/auctions/video/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      // Check if video already uploaded
      if (result.already_uploaded) {
        setAuctionId(result.auction_id);
        setBidId(result.bid_id);
        setUploadSuccess(true);
        return;
      }

      if (result.success && result.valid && result.auction_id && result.bid_id) {
        setIsValid(true);
        setAuctionId(result.auction_id);
        setBidId(result.bid_id);
        setCreatorName(result.creator_name || 'the auction creator');
        if (result.token_expires_at) {
          setTokenExpiresAt(new Date(result.token_expires_at));
        }
      } else {
        setError(result.error || 'Invalid or expired recording link');
      }
    } catch (err) {
      setError('Failed to validate recording link');
    } finally {
      setIsValidating(false);
    }
  };

  const handleUploadSuccess = (videoUrl: string) => {
    setUploadSuccess(true);
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Validating your recording link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link expired</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: '#F9FAFB',
          position: 'relative'
        }}
      >
        {/* Background layer with opacity */}
        <div
          className="absolute inset-0 pointer-events-none auction-detail-bg"
          style={{
            backgroundImage: 'url(/Pattern.jpeg)',
            backgroundPosition: 'top left',
            backgroundRepeat: 'repeat',
            opacity: 0.5,
            zIndex: 1
          }}
        />

        {/* Success Modal */}
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center" style={{ position: 'relative', zIndex: 10 }}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Video Uploaded!</h1>
          <button
            onClick={() => {
              router.push(`/auctions/${auctionId}`);
            }}
            className="block w-full px-6 py-3 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
          >
            View Auction
          </button>
        </div>
      </div>
    );
  }

  if (!isValid || !auctionId || !bidId) {
    return null;
  }

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{
        backgroundColor: '#F9FAFB',
        position: 'relative'
      }}
    >
      {/* Background layer with opacity */}
      <div
        className="absolute inset-0 pointer-events-none auction-detail-bg"
        style={{
          backgroundImage: 'url(/Pattern.jpeg)',
          backgroundPosition: 'top left',
          backgroundRepeat: 'repeat',
          opacity: 0.5,
          zIndex: 1
        }}
      />

      {/* Video Recorder */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <VideoRecorder
          auctionId={auctionId}
          bidId={bidId}
          recordingToken={token}
          recordingMethod="email_link"
          tokenExpiresAt={tokenExpiresAt}
          isExpired={isExpired}
          onSuccess={handleUploadSuccess}
        />
      </div>

      {/* Footer Info */}
      <div className="max-w-full sm:max-w-[537px] mx-auto mt-8" style={{ position: 'relative', zIndex: 10 }}>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm text-purple-700">
            <p className="font-medium mb-1">Important</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Only {creatorName} can watch your video</li>
              <li>This link expires in 24 hours</li>
              <li>Videos are automatically deleted after 7 days</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
