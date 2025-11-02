/**
 * Winner Notification Component
 * In-page notification when user wins an auction
 */

'use client';

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { formatBidAmount } from '@/lib/models/Bid.model';

interface WinnerNotificationProps {
  isOpen: boolean;
  auctionTitle: string;
  winningAmount: number;
  recordingToken?: string;
  onClose: () => void;
  onRecordVideo?: () => void;
}

export function WinnerNotification({
  isOpen,
  auctionTitle,
  winningAmount,
  recordingToken,
  onClose,
  onRecordVideo,
}: WinnerNotificationProps) {
  const router = useRouter();

  const handleRecordNow = () => {
    if (onRecordVideo) {
      onRecordVideo();
    } else if (recordingToken) {
      router.push(`/auctions/video/${recordingToken}`);
    }
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                {/* Header with Confetti */}
                <div className="bg-gradient-to-r from-green-400 to-blue-500 px-6 py-8 text-center">
                  <div className="text-6xl mb-3">🎉</div>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold text-white mb-2"
                  >
                    Congratulations!
                  </Dialog.Title>
                  <p className="text-white text-opacity-90">
                    You won the auction!
                  </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Auction</p>
                    <p className="text-lg font-semibold text-gray-900">{auctionTitle}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 mb-1">Winning Bid</p>
                    <p className="text-3xl font-bold text-green-700">
                      {formatBidAmount(winningAmount)}
                    </p>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-blue-600"
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
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                          Record a Video Message
                        </h4>
                        <p className="text-sm text-gray-600">
                          Share a 10-second video message with the auction creator!
                          You can retake once if needed.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 pt-4">
                    {recordingToken && (
                      <button
                        onClick={handleRecordNow}
                        className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                      >
                        <svg
                          className="w-5 h-5"
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
                        Record Video Now
                      </button>
                    )}

                    <button
                      onClick={onClose}
                      className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      I'll Record Later
                    </button>
                  </div>

                  {recordingToken && (
                    <p className="text-xs text-gray-500 text-center">
                      You can also record your video from the email we sent you.
                      The link expires in 24 hours.
                    </p>
                  )}

                  {/* Payment Info */}
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-800">
                      <strong>Payment:</strong> Your payment method has been charged{' '}
                      {formatBidAmount(winningAmount)}. You'll receive a receipt via email.
                    </p>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

/**
 * Compact Winner Badge (for auction cards)
 */
export function WinnerBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full ${className}`}>
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-xs font-medium">Winner</span>
    </div>
  );
}
