/**
 * Guest Bidder Form Component
 * Collects name and WhatsApp OR Email for guest bidders
 */

'use client';

import React, { useState, useEffect } from 'react';

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

export function GuestBidderForm({ auctionId, onSubmit, onCancel, isLoading = false }: GuestBidderFormProps) {
  const GUEST_BIDDER_STORAGE_KEY = `decode_guest_bidder_${auctionId}`;
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod | null>(null);
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+971'); // UAE default
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [errors, setErrors] = useState<{ name?: string; contact?: string; method?: string }>({});

  // Load saved guest info from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_BIDDER_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.contactMethod) setContactMethod(data.contactMethod);
        if (data.email) setEmail(data.email);
        if (data.countryCode) setCountryCode(data.countryCode);
        if (data.whatsappNumber) setWhatsappNumber(data.whatsappNumber);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [GUEST_BIDDER_STORAGE_KEY]);

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

      // Save to localStorage for future visits
      try {
        localStorage.setItem(
          GUEST_BIDDER_STORAGE_KEY,
          JSON.stringify({
            name: trimmedName,
            contactMethod,
            email: contactMethod === 'email' ? submissionData.email : '',
            countryCode,
            whatsappNumber: contactMethod === 'whatsapp' ? whatsappNumber : '',
          })
        );
      } catch {
        // Ignore localStorage errors
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
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
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
            className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
              contactMethod === 'whatsapp'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            <span className="font-medium text-sm">WhatsApp</span>
            <span className="text-xs opacity-90 mt-1">
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
            className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all ${
              contactMethod === 'email'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            <span className="font-medium text-sm">Email</span>
            <span className="text-xs opacity-90 mt-1">
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
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isLoading}
                className="w-[108px] px-2 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="+971">🇦🇪 +971</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+91">🇮🇳 +91</option>
                <option value="+966">🇸🇦 +966</option>
                <option value="+20">🇪🇬 +20</option>
                <option value="+974">🇶🇦 +974</option>
                <option value="+965">🇰🇼 +965</option>
                <option value="+968">🇴🇲 +968</option>
                <option value="+973">🇧🇭 +973</option>
              </select>
              <input
                type="tel"
                id="whatsapp-number"
                value={whatsappNumber}
                onChange={(e) => {
                  setWhatsappNumber(e.target.value);
                  if (errors.contact) setErrors({ ...errors, contact: undefined });
                }}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
                  errors.contact ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="50 123 4567"
                disabled={isLoading}
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
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ${
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

      {/* Submit Buttons */}
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
        {contactMethod && (
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
        )}
      </div>
    </form>
  );
}
