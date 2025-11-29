/**
 * Link Beauty Business Modal
 * Modal for selecting existing beauty businesses or creating new ones
 */

'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface LinkBeautyBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (businessId: string | null) => void;
}

export function LinkBeautyBusinessModal({ isOpen, onClose, onLink }: LinkBeautyBusinessModalProps) {
  const [businessType, setBusinessType] = useState<'existing' | 'new' | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [formData, setFormData] = useState({
    businessName: '',
    instagramHandle: '',
    city: '',
  });

  // Reset state when modal closes
  const handleClose = () => {
    setBusinessType(null);
    setSelectedBusiness('');
    setFormData({ businessName: '', instagramHandle: '', city: '' });
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create new business
    console.log('Creating new business:', formData);
    alert('Business created successfully! (UI demo - not saved yet)');
    setFormData({ businessName: '', instagramHandle: '', city: '' });
    setBusinessType(null);
  };

  const handleLinkBusiness = () => {
    // TODO: Link selected business to auction
    console.log('Linking business:', selectedBusiness);
    onLink(selectedBusiness || null);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Link Beauty Business</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Selection Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBusinessType('existing')}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                businessType === 'existing'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium text-sm">Existing Business</span>
              <span className="text-[10px] opacity-90 mt-0.5">
                {businessType === 'existing' ? 'Select from list' : 'My connected businesses'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBusinessType('new')}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                businessType === 'new'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium text-sm">New Business</span>
              <span className="text-[10px] opacity-90 mt-0.5">
                {businessType === 'new' ? 'Fill in details below' : 'Create new business'}
              </span>
            </button>
          </div>

          {/* Existing Business Content */}
          {businessType === 'existing' && (
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                My Connected Beauty Businesses
              </label>
              <select
                value={selectedBusiness}
                onChange={(e) => setSelectedBusiness(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a business</option>
                <option value="demo-1">Demo Business 1 (Coming Soon)</option>
                <option value="demo-2">Demo Business 2 (Coming Soon)</option>
              </select>
            </div>
          )}

          {/* New Business Form */}
          {businessType === 'new' && (
            <form onSubmit={handleSubmitNew} className="space-y-4">
              {/* Business Name */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="e.g., Glow Beauty Studio"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Instagram Handle */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Instagram Handle *
                </label>
                <div className="flex items-center bg-gray-800 border border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <span className="pl-4 text-gray-400">@</span>
                  <input
                    type="text"
                    required
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    placeholder="beautyglowstudio"
                    className="flex-1 px-2 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., Los Angeles"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Profile Image Upload Placeholder */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Profile Image (Coming Soon)
                </label>
                <div className="w-full px-4 py-8 bg-gray-800 border border-dashed border-gray-600 rounded-lg text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Upload feature coming soon</p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Create Business
              </button>
            </form>
          )}
        </div>

        {/* Footer - Only show for existing business selection */}
        {businessType === 'existing' && (
          <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 px-6 py-4 flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLinkBusiness}
              disabled={!selectedBusiness}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              Link Business
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render modal at document.body level, bypassing backdrop-filter containment
  if (typeof window === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
