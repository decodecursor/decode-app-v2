/**
 * Instagram Username Form Component
 * Optional step to collect Instagram username from bidders
 */

'use client';

import React, { useState } from 'react';
import { validateInstagramUsername } from '@/lib/models/Bid.model';

interface InstagramUsernameFormProps {
  onSubmit: (instagramUsername?: string) => void;
  onSkip?: () => void;
  isLoading?: boolean;
}

export function InstagramUsernameForm({ onSubmit, onSkip, isLoading = false }: InstagramUsernameFormProps) {
  const [instagramUsername, setInstagramUsername] = useState('');
  const [error, setError] = useState<string | undefined>();

  const validate = (): boolean => {
    if (!instagramUsername.trim()) {
      // Empty is valid (optional field)
      return true;
    }

    const validation = validateInstagramUsername(instagramUsername);
    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const trimmedUsername = instagramUsername.trim();
      onSubmit(trimmedUsername || undefined);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onSubmit(undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instagram Username Input */}
      <div>
        <label htmlFor="instagram-username" className="block text-xs font-medium text-gray-700 mb-1">
          Instagram Username <span className="text-gray-500 font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
          <input
            type="text"
            id="instagram-username"
            value={instagramUsername}
            onChange={(e) => {
              setInstagramUsername(e.target.value);
              if (error) setError(undefined);
            }}
            className={`w-full pl-8 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="yourhandle"
            disabled={isLoading}
            maxLength={30}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <p className="mt-1 text-[10px] text-gray-500">
          📸 Share your Instagram to help us connect with you and feature your winning bids
        </p>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSkip}
          disabled={isLoading}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Skip
        </button>
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
    </form>
  );
}
