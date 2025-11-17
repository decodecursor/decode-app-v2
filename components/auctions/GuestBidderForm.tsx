/**
 * Guest Bidder Form Component
 * Collects name and email for guest bidders
 */

'use client';

import React, { useState, useEffect } from 'react';

const GUEST_BIDDER_STORAGE_KEY = 'decode_guest_bidder';

interface GuestBidderFormProps {
  onSubmit: (data: { name: string; email: string }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function GuestBidderForm({ onSubmit, onCancel, isLoading = false }: GuestBidderFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  // Load saved guest info from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_BIDDER_STORAGE_KEY);
      if (saved) {
        const { name: savedName, email: savedEmail } = JSON.parse(saved);
        if (savedName) setName(savedName);
        if (savedEmail) setEmail(savedEmail);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const trimmedName = name.trim();
      const trimmedEmail = email.toLowerCase().trim();

      // Save to localStorage for future visits
      try {
        localStorage.setItem(
          GUEST_BIDDER_STORAGE_KEY,
          JSON.stringify({ name: trimmedName, email: trimmedEmail })
        );
      } catch {
        // Ignore localStorage errors
      }

      onSubmit({ name: trimmedName, email: trimmedEmail });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-1">
          Your Name *
        </label>
        <input
          type="text"
          id="guest-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors({ ...errors, name: undefined });
          }}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="John Doe"
          disabled={isLoading}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address *
        </label>
        <input
          type="email"
          id="guest-email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="john@example.com"
          disabled={isLoading}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        <p className="mt-1 text-xs text-gray-500">
          We'll use this to notify you if you win or get outbid
        </p>
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
              Continue
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          By continuing, you agree to receive email notifications about this auction.
          <br />
          Your information is kept private and secure.
        </p>
      </div>
    </form>
  );
}
