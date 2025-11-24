/**
 * Instagram Username Form Component
 * Optional step to collect Instagram username from bidders
 */

'use client';

import React, { useState } from 'react';
import { validateInstagramUsername } from '@/lib/models/Bid.model';

interface InstagramUsernameFormProps {
  onSubmit: (instagramUsername?: string) => void;
  isLoading?: boolean;
}

export function InstagramUsernameForm({ onSubmit, isLoading = false }: InstagramUsernameFormProps) {
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


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instagram Username Input */}
      <div>
        <label htmlFor="instagram-username" className="block text-xs font-medium text-gray-700 mb-1">
          Your Instagram Username <span className="text-gray-500 font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <input
            type="text"
            id="instagram-username"
            value={instagramUsername}
            onChange={(e) => {
              setInstagramUsername(e.target.value);
              if (error) setError(undefined);
            }}
            className={`w-full pl-9 pr-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="yourhandle"
            disabled={isLoading}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck="false"
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <p className="mt-1 text-[10px] text-gray-500">
          We link your Instagram on the leaderboard
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </form>
  );
}
