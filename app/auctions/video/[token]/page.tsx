/**
 * Video Recording Page (Email Link Fallback)
 * Secure page for winners to record video via email link
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoRecorder } from '@/components/auctions/VideoRecorder';

export default function VideoRecordingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [bidId, setBidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

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
        setUploadSuccess(true);
        return;
      }

      if (result.success && result.valid && result.auction_id && result.bid_id) {
        setIsValid(true);
        setAuctionId(result.auction_id);
        setBidId(result.bid_id);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/auctions"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            View Auctions
          </a>
        </div>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Video Uploaded!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for sharing your video message. The auction creator will be able to view it.
          </p>
          <div className="space-y-3">
            <a
              href="/auctions"
              className="block w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
            >
              View More Auctions
            </a>
            <button
              onClick={() => window.close()}
              className="block w-full px-6 py-3 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isValid || !auctionId || !bidId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Record Your Winner Video! 🎉
        </h1>
        <p className="text-lg text-gray-700 font-medium">
          Click "Start Camera" to record a 10-second video message
        </p>
      </div>

      {/* Video Recorder */}
      <VideoRecorder
        auctionId={auctionId}
        bidId={bidId}
        recordingToken={token}
        recordingMethod="email_link"
        onSuccess={handleUploadSuccess}
      />

      {/* Footer Info */}
      <div className="max-w-3xl mx-auto mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg
              className="flex-shrink-0 w-5 h-5 text-blue-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Important Information</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>This link expires in 24 hours</li>
                <li>You can retake your video once if needed</li>
                <li>Videos are automatically deleted after 7 days</li>
                <li>Only the auction creator can view your video</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
