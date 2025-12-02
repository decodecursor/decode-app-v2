/**
 * Create Auction Modal Component
 * Modal for MODEL users to create new auctions
 */

'use client';

import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AUCTION_DURATIONS, type AuctionDuration } from '@/lib/models/Auction.model';

interface CreateAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (auctionId: string) => void;
}

export function CreateAuctionModal({ isOpen, onClose, onSuccess }: CreateAuctionModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    auction_start_price: '',
    duration: 60 as AuctionDuration,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [priceFocused, setPriceFocused] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    const startPrice = parseFloat(formData.auction_start_price);
    if (!formData.auction_start_price || isNaN(startPrice) || startPrice <= 0) {
      newErrors.auction_start_price = 'Please enter a valid starting price';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const requestPayload = {
        title: formData.title.trim(),
        auction_start_price: parseFloat(formData.auction_start_price),
        duration: formData.duration,
      };

      console.log('🚀 [CreateAuction] Sending request:', requestPayload);

      const response = await fetch('/api/auctions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      console.log('📥 [CreateAuction] Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📋 [CreateAuction] Response data:', data);

      if (!response.ok) {
        console.error('❌ [CreateAuction] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details,
          fullResponse: data
        });
        throw new Error(data.error || 'Failed to create auction');
      }

      // Success
      console.log('✅ [CreateAuction] Auction created successfully:', data.auction_id);
      if (onSuccess) {
        onSuccess(data.auction_id);
      }
      handleClose();
    } catch (err) {
      console.error('💥 [CreateAuction] Exception caught:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to create auction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      title: '',
      auction_start_price: '',
      duration: 60,
    });
    setErrors({});
    setSubmitError(null);
    setTouched({});
    setPriceFocused(false);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-gray-900 border border-gray-700 pt-2 px-6 pb-6 md:px-8 md:pb-8 shadow-xl transition-all relative">
                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="absolute md:top-4 md:right-4 top-2 right-2 text-gray-400 hover:text-white transition-colors"
                  disabled={isSubmitting}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Header */}
                <div className="text-center md:mb-8 mb-6">
                  <div className="mb-0 flex justify-center">
                    <img
                      src="/images/Mascot_Letsgooo_png.png"
                      alt="Create auction mascot"
                      className="w-[160px] h-auto object-contain -my-8"
                    />
                  </div>
                  <Dialog.Title
                    as="h2"
                    className="md:text-2xl text-xl font-bold text-white mb-2"
                  >
                    Create Auction
                  </Dialog.Title>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                      Auction Title
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value });
                        if (errors.title) setErrors({ ...errors, title: undefined });
                      }}
                      className={`w-full md:px-4 md:py-3 px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none transition-colors ${
                        errors.title ? 'border-red-500' : 'border-gray-700 focus:border-purple-500'
                      }`}
                      placeholder="Russian Lips"
                      disabled={isSubmitting}
                    />
                    {errors.title && <p className="mt-1 text-sm text-red-100">{errors.title}</p>}
                  </div>

                  {/* Starting Price */}
                  <div>
                    <label htmlFor="auction_start_price" className="block text-sm font-medium text-gray-300 mb-2">
                      Starting Price
                    </label>
                    <div className="relative">
                      <span className={`absolute left-3 md:left-4 top-1/2 -translate-y-1/2 transition-colors ${
                        priceFocused || formData.auction_start_price ? 'text-white' : 'text-gray-400'
                      }`}>AED</span>
                      <input
                        type="number"
                        id="auction_start_price"
                        value={formData.auction_start_price}
                        onFocus={() => setPriceFocused(true)}
                        onBlur={() => setPriceFocused(false)}
                        onChange={(e) => {
                          setFormData({ ...formData, auction_start_price: e.target.value });
                          if (errors.auction_start_price) setErrors({ ...errors, auction_start_price: undefined });
                        }}
                        min="0"
                        step="0.01"
                        className={`w-full pl-[49px] md:pl-[53px] md:pr-4 pr-3 md:py-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none transition-colors ${
                          errors.auction_start_price ? 'border-red-500' : 'border-gray-700 focus:border-purple-500'
                        }`}
                        placeholder="10.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.auction_start_price && (
                      <p className="mt-1 text-sm text-red-100">{errors.auction_start_price}</p>
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-300 mb-2">
                      Auction Duration
                    </label>
                    <select
                      id="duration"
                      value={formData.duration}
                      onMouseDown={() => setTouched({ ...touched, duration: true })}
                      onClick={() => setTouched({ ...touched, duration: true })}
                      onChange={(e) => {
                        setTouched({ ...touched, duration: true });
                        setFormData({ ...formData, duration: parseInt(e.target.value) as AuctionDuration });
                      }}
                      className={`w-full md:px-4 md:py-3 px-3 py-2 bg-gray-800 border rounded-lg focus:outline-none transition-colors ${
                        touched.duration ? 'border-purple-500 text-white' : 'border-gray-700 focus:border-purple-500 text-gray-400'
                      }`}
                      style={{
                        color: touched.duration ? '#fff' : '#9ca3af',
                        WebkitTextFillColor: touched.duration ? '#fff' : '#9ca3af',
                        cursor: 'pointer'
                      } as React.CSSProperties}
                      disabled={isSubmitting}
                    >
                      {AUCTION_DURATIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Submit Error */}
                  {submitError && (
                    <div className="p-4 bg-red-600/20 border border-red-500/30 rounded-lg text-red-100">
                      {submitError}
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 cosmic-button-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.title.trim() || !formData.auction_start_price || !touched.duration}
                      className={`flex-1 font-medium md:py-3 md:px-4 py-2 px-3 rounded-lg transition-colors ${
                        formData.title.trim() && formData.auction_start_price && touched.duration
                          ? 'bg-purple-600 hover:bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Auction'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
