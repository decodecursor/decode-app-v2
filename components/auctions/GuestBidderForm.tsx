/**
 * Guest Bidder Form Component
 * Collects name and WhatsApp OR Email for guest bidders
 */

'use client';

import React, { useState, useEffect } from 'react';
import { safeLocalStorage } from '@/utils/storage-helper';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import { findCountryByCode } from '@/lib/country-codes';

type ContactMethod = 'whatsapp' | 'email';

interface GuestBidderFormProps {
  auctionId: string;
  onSubmit: (data: {
    name: string;
    contactMethod: ContactMethod;
    email?: string;
    whatsappNumber?: string;
  }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Format phone number to UAE format: XX XXX XXXX
 */
const formatUAEPhoneNumber = (value: string): string => {
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, '');

  // Apply UAE format: XX XXX XXXX
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 5) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  } else {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 9)}`;
  }
};

export function GuestBidderForm({ auctionId, onSubmit, onCancel, isLoading = false }: GuestBidderFormProps) {
  const GUEST_BIDDER_STORAGE_KEY = `decode_guest_bidder_${auctionId}`;
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod | null>(null);
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+971'); // UAE default
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [errors, setErrors] = useState<{ name?: string; contact?: string; method?: string }>({});

  // Load saved guest info from localStorage on mount with Edge browser safety
  useEffect(() => {
    try {
      const saved = safeLocalStorage.getItem(GUEST_BIDDER_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.contactMethod) setContactMethod(data.contactMethod);
        if (data.email) setEmail(data.email);
        if (data.countryCode) setCountryCode(data.countryCode);
        if (data.whatsappNumber) setWhatsappNumber(data.whatsappNumber);

        // Log successful restoration for debugging Edge issues
        console.log('[GuestBidderForm] Restored guest info from storage:', {
          auction_id: auctionId,
          has_name: !!data.name,
          contact_method: data.contactMethod,
          browser: typeof navigator !== 'undefined' && navigator.userAgent.includes('Edg') ? 'Edge' : 'Other'
        });
      }
    } catch (error) {
      console.error('[GuestBidderForm] Error loading saved guest info:', error);
    }
  }, [GUEST_BIDDER_STORAGE_KEY, auctionId]);

  const validate = (): boolean => {
    const newErrors: { name?: string; contact?: string; method?: string } = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Validate contact method selected
    if (!contactMethod) {
      newErrors.method = 'Please select a contact method';
    } else if (contactMethod === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        newErrors.contact = 'Email is required';
      } else if (!emailRegex.test(email)) {
        newErrors.contact = 'Please enter a valid email address';
      }
    } else if (contactMethod === 'whatsapp') {
      // Basic phone number validation (digits only, 7-15 digits)
      const phoneRegex = /^[0-9]{7,15}$/;
      const cleanNumber = whatsappNumber.replace(/[\s-]/g, '');
      if (!whatsappNumber.trim()) {
        newErrors.contact = 'WhatsApp number is required';
      } else if (!phoneRegex.test(cleanNumber)) {
        newErrors.contact = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const trimmedName = name.trim();

      // Prepare data based on contact method
      const submissionData: {
        name: string;
        contactMethod: ContactMethod;
        email?: string;
        whatsappNumber?: string;
      } = {
        name: trimmedName,
        contactMethod,
      };

      if (contactMethod === 'email') {
        submissionData.email = email.toLowerCase().trim();
      } else {
        // Combine country code and number
        const cleanNumber = whatsappNumber.replace(/[\s-]/g, '');
        submissionData.whatsappNumber = `${countryCode}${cleanNumber}`;
      }

      // Save to localStorage for future visits with Edge browser safety
      try {
        const storageData = {
          name: trimmedName,
          contactMethod,
          email: contactMethod === 'email' ? submissionData.email : '',
          countryCode,
          whatsappNumber: contactMethod === 'whatsapp' ? whatsappNumber : '',
          savedAt: new Date().toISOString(),
          browser: typeof navigator !== 'undefined' && navigator.userAgent.includes('Edg') ? 'Edge' : 'Other'
        };

        safeLocalStorage.setItem(
          GUEST_BIDDER_STORAGE_KEY,
          JSON.stringify(storageData)
        );

        console.log('[GuestBidderForm] Saved guest info to storage:', {
          auction_id: auctionId,
          contact_method: contactMethod,
          browser: storageData.browser,
          timestamp: storageData.savedAt
        });
      } catch (error) {
        console.error('[GuestBidderForm] Error saving guest info to storage:', error);
      }

      onSubmit(submissionData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name Input */}
      <div>
        <label htmlFor="guest-name" className="block text-xs font-medium text-gray-700 mb-1">
          Your Name (for Leaderboard)
        </label>
        <input
          type="text"
          id="guest-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors({ ...errors, name: undefined });
          }}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="John Doe"
          disabled={isLoading}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Contact Method Selection */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          How would you like to receive auction updates?
        </label>

        {/* Button Selection */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            type="button"
            onClick={() => {
              setContactMethod('whatsapp');
              if (errors.contact) setErrors({ ...errors, contact: undefined });
            }}
            disabled={isLoading}
            className={`flex flex-col items-center justify-center p-2 border-2 rounded-lg transition-all ${
              contactMethod === 'whatsapp'
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            <span className="font-medium text-sm">WhatsApp</span>
            <span className="text-[10px] opacity-90 mt-0.5">
              {contactMethod === 'whatsapp' ? 'Instant notifications' : 'Get instant updates'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactMethod('email');
              if (errors.contact) setErrors({ ...errors, contact: undefined });
            }}
            disabled={isLoading}
            className={`flex flex-col items-center justify-center p-2 border-2 rounded-lg transition-all ${
              contactMethod === 'email'
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            <span className="font-medium text-sm">Email</span>
            <span className="text-[10px] opacity-90 mt-0.5">
              {contactMethod === 'email' ? 'Traditional updates' : 'Email notifications'}
            </span>
          </button>
        </div>

        {/* Method selection error */}
        {errors.method && <p className="mt-1 text-sm text-red-600">{errors.method}</p>}

        {/* Dynamic Input Field */}
        {contactMethod === 'whatsapp' ? (
          <div>
            <label htmlFor="whatsapp-number" className="block text-xs font-medium text-gray-700 mb-1">
              WhatsApp Number
            </label>
            <div className="flex space-x-2">
              <CountryCodeSelector
                value={countryCode}
                onChange={setCountryCode}
                disabled={isLoading}
                variant="light"
              />
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => {
                  const formatted = formatUAEPhoneNumber(e.target.value);
                  setWhatsappNumber(formatted);
                  if (errors.contact) setErrors({ ...errors, contact: undefined });
                }}
                className="cosmic-input flex-1 !border !border-gray-300 focus:!border-purple-500 focus:!ring-purple-500 !text-gray-700 placeholder:text-gray-400"
                placeholder={findCountryByCode(countryCode)?.placeholder || '50 123 4567'}
                disabled={isLoading}
                autoComplete="tel"
              />
            </div>
            {errors.contact && <p className="mt-1 text-sm text-red-600">{errors.contact}</p>}
            <p className="mt-1 text-[10px] text-gray-500">
              💬 You'll get instant updates on your bid status via WhatsApp
            </p>
          </div>
        ) : contactMethod === 'email' ? (
          <div>
            <label htmlFor="guest-email" className="block text-xs font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="guest-email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.contact) setErrors({ ...errors, contact: undefined });
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900 ${
                errors.contact ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="john@example.com"
              disabled={isLoading}
            />
            {errors.contact && <p className="mt-1 text-sm text-red-600">{errors.contact}</p>}
            <p className="mt-1 text-[10px] text-gray-500">
              📧 You'll receive updates via email
            </p>
          </div>
        ) : null}
      </div>

      {/* Submit Button */}
      {contactMethod && (
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 text-base font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
      )}
    </form>
  );
}
