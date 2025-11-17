/**
 * Video Recorder Component
 * Records 10-second video using MediaRecorder API with compression
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MAX_VIDEO_DURATION_SECONDS, MAX_RETAKES } from '@/lib/models/AuctionVideo.model';

interface VideoRecorderProps {
  auctionId: string;
  bidId: string;
  recordingToken?: string;
  recordingMethod: 'in_page' | 'email_link';
  onSuccess?: (videoUrl: string) => void;
  onCancel?: () => void;
  maxRetakes?: number;
}

type RecordingState = 'idle' | 'requesting_permission' | 'ready' | 'recording' | 'stopped' | 'uploading';

// Get best supported MIME type for current browser
function getSupportedMimeType(): { mimeType: string; extension: string } {
  const types = [
    // Video + Audio codecs (required for Firefox and proper audio recording)
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=h264,opus', extension: 'webm' },
    // Video only codecs (Chrome might work with these)
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
    // Generic formats
    { mimeType: 'video/webm', extension: 'webm' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type.mimeType)) {
      console.log('Using MIME type:', type.mimeType);
      return type;
    }
  }

  // Fallback - let browser choose
  console.log('No specific MIME type supported, using browser default');
  return { mimeType: '', extension: 'webm' };
}

export function VideoRecorder({
  auctionId,
  bidId,
  recordingToken,
  recordingMethod,
  onSuccess,
  onCancel,
  maxRetakes = MAX_RETAKES,
}: VideoRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retakeCount, setRetakeCount] = useState(0);
  const [mimeInfo, setMimeInfo] = useState<{ mimeType: string; extension: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request camera permission and setup preview
  const requestCamera = async () => {
    try {
      setRecordingState('requesting_permission');
      setError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setRecordingState('ready');
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please grant camera permissions and try again.');
      setRecordingState('idle');
    }
  };

  // Start recording
  const startRecording = () => {
    if (!stream) return;

    try {
      chunksRef.current = [];

      // Get best supported MIME type for this browser
      const supportedMime = getSupportedMimeType();
      setMimeInfo(supportedMime);

      let mediaRecorder: MediaRecorder;

      // Try with detected MIME type first, fallback to no options
      try {
        if (supportedMime.mimeType) {
          const options: MediaRecorderOptions = {
            mimeType: supportedMime.mimeType,
            videoBitsPerSecond: 1000000, // 1 Mbps for compression
          };
          mediaRecorder = new MediaRecorder(stream, options);
          console.log('MediaRecorder created with:', supportedMime.mimeType);
        } else {
          mediaRecorder = new MediaRecorder(stream);
          console.log('MediaRecorder created with default settings');
        }
      } catch (codecError) {
        // Fallback: create without any options (let browser decide)
        console.warn('Failed with codec options, trying default:', codecError);
        mediaRecorder = new MediaRecorder(stream);
        setMimeInfo({ mimeType: '', extension: 'webm' });
        console.log('MediaRecorder created with browser default');
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the actual MIME type from the recorder
        const blobType = mediaRecorder.mimeType || supportedMime.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        console.log('Recording completed. Blob type:', blobType, 'Size:', blob.size);
        setRecordedBlob(blob);
        setRecordingState('stopped');

        // Show preview
        if (previewRef.current) {
          previewRef.current.src = URL.createObjectURL(blob);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed. Please try a different browser.');
        setRecordingState('ready');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState('recording');
      console.log('Recording started');

      // Auto-stop after MAX_VIDEO_DURATION_SECONDS
      recordingTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_VIDEO_DURATION_SECONDS * 1000);

      // Countdown timer
      let timeLeft = MAX_VIDEO_DURATION_SECONDS;
      setCountdown(timeLeft);

      countdownIntervalRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);
        if (timeLeft <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
        }
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRecordingState('ready');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Upload video
  const uploadVideo = async () => {
    if (!recordedBlob) return;

    setRecordingState('uploading');
    setError(null);

    try {
      const formData = new FormData();
      // Use correct file extension based on detected MIME type
      const extension = mimeInfo?.extension || 'webm';
      formData.append('video', recordedBlob, `recording.${extension}`);
      formData.append('bid_id', bidId);
      formData.append('recording_method', recordingMethod);
      if (recordingToken) {
        formData.append('recording_token', recordingToken);
      }

      const response = await fetch(`/api/auctions/${auctionId}/video/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      if (onSuccess) {
        onSuccess(data.file_url);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      setRecordingState('stopped');
    }
  };

  // Retake video
  const retake = () => {
    if (retakeCount >= maxRetakes) {
      setError(`Maximum ${maxRetakes} retake${maxRetakes !== 1 ? 's' : ''} allowed`);
      return;
    }

    setRetakeCount(retakeCount + 1);
    setRecordedBlob(null);
    setRecordingState('idle');
    requestCamera();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [stream]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Video Display */}
        <div className="relative bg-black aspect-video">
          {/* Live Preview */}
          {(recordingState === 'ready' || recordingState === 'recording') && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Recorded Preview */}
          {recordingState === 'stopped' && (
            <video
              ref={previewRef}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
          )}

          {/* Idle State */}
          {recordingState === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white p-6">
                <svg
                  className="mx-auto w-20 h-20 mb-4 opacity-50"
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
                <p className="text-lg font-medium">Ready to record?</p>
                <p className="text-sm opacity-75 mt-1">
                  Record a {MAX_VIDEO_DURATION_SECONDS}-second video message
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {(recordingState === 'requesting_permission' || recordingState === 'uploading') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-center text-white">
                <svg className="animate-spin h-12 w-12 mx-auto mb-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm">
                  {recordingState === 'requesting_permission'
                    ? 'Requesting camera access...'
                    : 'Uploading video...'}
                </p>
              </div>
            </div>
          )}

          {/* Recording Indicator */}
          {recordingState === 'recording' && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-full">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="font-semibold">{countdown}s remaining</span>
            </div>
          )}

          {/* Retake Counter */}
          {retakeCount > 0 && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              Retake {retakeCount}/{maxRetakes}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Recording will automatically stop after {MAX_VIDEO_DURATION_SECONDS} seconds</li>
              <li>You can retake once if needed</li>
              <li>Make sure you have good lighting and audio</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {recordingState === 'idle' && (
              <>
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={requestCamera}
                  className="flex-1 px-4 py-3 text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Start Camera
                </button>
              </>
            )}

            {recordingState === 'ready' && (
              <>
                <button
                  onClick={() => {
                    stopRecording();
                    setRecordingState('idle');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={startRecording}
                  className="flex-1 px-4 py-3 text-base font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <div className="w-4 h-4 bg-white rounded-full" />
                  Start Recording
                </button>
              </>
            )}

            {recordingState === 'recording' && (
              <button
                onClick={stopRecording}
                className="w-full px-4 py-3 text-base font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900"
              >
                Stop Recording
              </button>
            )}

            {recordingState === 'stopped' && (
              <>
                {retakeCount < maxRetakes && (
                  <button
                    onClick={retake}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Retake ({maxRetakes - retakeCount} left)
                  </button>
                )}
                <button
                  onClick={uploadVideo}
                  className="flex-1 px-4 py-3 text-base font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Upload Video
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
