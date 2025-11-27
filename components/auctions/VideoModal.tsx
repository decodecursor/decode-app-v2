/**
 * Video Modal Component
 * Modal for displaying auction videos
 */

'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { VideoPlayback } from './VideoPlayback';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionId: string;
  auctionTitle: string;
  onPayoutUnlocked?: () => void;
}

export function VideoModal({ isOpen, onClose, auctionId, auctionTitle, onPayoutUnlocked }: VideoModalProps) {
  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="cosmic-card max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold text-lg">{auctionTitle}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Content */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <VideoPlayback auctionId={auctionId} onPayoutUnlocked={onPayoutUnlocked} />
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document.body level, bypassing backdrop-filter containment
  if (typeof window === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
