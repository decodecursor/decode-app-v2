/**
 * TEST ONLY - Video Recording Test Page
 * Delete this file after testing
 */

'use client';

import React, { useState, useEffect } from 'react';
import { VideoRecorder } from '@/components/auctions/VideoRecorder';
import { createClient } from '@/utils/supabase/client';

export default function TestVideoRecordingPage() {
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [bidId, setBidId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    fetchTestData();
  }, []);

  const fetchTestData = async () => {
    try {
      const supabase = createClient();

      // Get a recent auction with a bid
      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .select('id, auction_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (bidError || !bidData) {
        setError('No bids found in database. Create an auction with a bid first.');
        return;
      }

      setAuctionId(bidData.auction_id);
      setBidId(bidData.id);
    } catch (err) {
      setError('Failed to fetch test data');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (videoUrl: string) => {
    setUploadSuccess(true);
    console.log('Video uploaded:', videoUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading test data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Setup Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Successful!</h1>
          <p className="text-gray-600 mb-6">
            Video recording and upload working correctly.
          </p>
          <button
            onClick={() => setUploadSuccess(false)}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            Test Again
          </button>
        </div>
      </div>
    );
  }

  if (!auctionId || !bidId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      {/* Warning Banner */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="flex-shrink-0 w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-yellow-700">
              <p className="font-semibold mb-1">TEST PAGE - DELETE AFTER TESTING</p>
              <p>Using Auction ID: {auctionId}</p>
              <p>Using Bid ID: {bidId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Video Recording Test
        </h1>
        <p className="text-gray-600">
          Test the 10-second video recording feature
        </p>
      </div>

      {/* Video Recorder - No token means no token validation on upload */}
      <VideoRecorder
        auctionId={auctionId}
        bidId={bidId}
        recordingMethod="in_page"
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
