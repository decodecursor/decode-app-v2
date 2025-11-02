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
    description: '',
    start_price: '',
    buy_now_price: '',
    duration: 60 as AuctionDuration,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    const startPrice = parseFloat(formData.start_price);
    if (!formData.start_price || isNaN(startPrice) || startPrice <= 0) {
      newErrors.start_price = 'Please enter a valid starting price';
    }

    if (formData.buy_now_price) {
      const buyNowPrice = parseFloat(formData.buy_now_price);
      if (isNaN(buyNowPrice) || buyNowPrice <= startPrice) {
        newErrors.buy_now_price = 'Buy now price must be higher than starting price';
      }
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
      const response = await fetch('/api/auctions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          start_price: parseFloat(formData.start_price),
          buy_now_price: formData.buy_now_price
            ? parseFloat(formData.buy_now_price)
            : undefined,
          duration: formData.duration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create auction');
      }

      // Success
      if (onSuccess) {
        onSuccess(data.auction_id);
      }
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create auction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      title: '',
      description: '',
      start_price: '',
      buy_now_price: '',
      duration: 60,
    });
    setErrors({});
    setSubmitError(null);
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-xl font-semibold leading-6 text-gray-900 mb-4"
                >
                  Create New Auction
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Auction Title *
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value });
                        if (errors.title) setErrors({ ...errors, title: undefined });
                      }}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.title ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Exclusive Beauty Session"
                      disabled={isSubmitting}
                    />
                    {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe what bidders will receive..."
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Starting Price */}
                  <div>
                    <label htmlFor="start_price" className="block text-sm font-medium text-gray-700 mb-1">
                      Starting Price *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        id="start_price"
                        value={formData.start_price}
                        onChange={(e) => {
                          setFormData({ ...formData, start_price: e.target.value });
                          if (errors.start_price) setErrors({ ...errors, start_price: undefined });
                        }}
                        min="0"
                        step="0.01"
                        className={`w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.start_price ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="10.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.start_price && (
                      <p className="mt-1 text-sm text-red-600">{errors.start_price}</p>
                    )}
                  </div>

                  {/* Buy Now Price (Optional) */}
                  <div>
                    <label htmlFor="buy_now_price" className="block text-sm font-medium text-gray-700 mb-1">
                      Buy Now Price (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        id="buy_now_price"
                        value={formData.buy_now_price}
                        onChange={(e) => {
                          setFormData({ ...formData, buy_now_price: e.target.value });
                          if (errors.buy_now_price) setErrors({ ...errors, buy_now_price: undefined });
                        }}
                        min="0"
                        step="0.01"
                        className={`w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.buy_now_price ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="100.00"
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.buy_now_price && (
                      <p className="mt-1 text-sm text-red-600">{errors.buy_now_price}</p>
                    )}
                  </div>

                  {/* Duration */}
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                      Auction Duration *
                    </label>
                    <select
                      id="duration"
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData({ ...formData, duration: parseInt(e.target.value) as AuctionDuration })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-600">{submitError}</p>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
