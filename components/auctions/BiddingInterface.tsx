/**
 * Bidding Interface Component
 * Main interface for placing bids with Stripe payment integration
 */

'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { GuestBidderForm } from './GuestBidderForm';
import { InstagramUsernameForm } from './InstagramUsernameForm';
import { calculateMinimumBid, formatBidAmount } from '@/lib/models/Bid.model';
import type { Auction } from '@/lib/models/Auction.model';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Format WhatsApp number for display (e.g., +971554275547 -> +971 55 427 5547)
function formatWhatsAppNumber(number: string): string {
  // Remove all spaces first
  const cleaned = number.replace(/\s/g, '');

  // Check if it's a UAE number (+971)
  if (cleaned.startsWith('+971')) {
    // Format as: +971 55 427 5547
    const countryCode = cleaned.substring(0, 4); // +971
    const part1 = cleaned.substring(4, 6); // 55
    const part2 = cleaned.substring(6, 9); // 427
    const part3 = cleaned.substring(9); // 5547
    return `${countryCode} ${part1} ${part2} ${part3}`;
  }

  // Return as-is for other formats
  return number;
}

// Format number with thousand separators (e.g., 10000 -> 10,000)
function formatNumberWithCommas(value: string): string {
  // Remove all non-digit characters (no decimal support)
  const cleanValue = value.replace(/\D/g, '');

  // Return empty string if no digits
  if (!cleanValue) return '';

  // Add commas for thousands
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Load guest bidder info from localStorage cache
function loadGuestInfoFromCache(auctionId: string): {
  name: string;
  contactMethod: 'whatsapp' | 'email';
  email?: string;
  whatsappNumber?: string;
} | null {
  try {
    const cacheKey = `decode_guest_bidder_${auctionId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Error loading guest info from cache:', error);
  }
  return null;
}

interface BiddingInterfaceProps {
  auction: Auction;
  userEmail?: string;
  userName?: string;
  onBidPlaced?: (bidId: string) => void;
}

export function BiddingInterface({
  auction,
  userEmail,
  userName,
  onBidPlaced,
}: BiddingInterfaceProps) {
  const [step, setStep] = useState<'amount' | 'guest_info' | 'instagram' | 'payment'>('amount');
  const [bidAmount, setBidAmount] = useState<string>('');
  const [guestInfo, setGuestInfo] = useState<{
    name: string;
    contactMethod: 'whatsapp' | 'email';
    email?: string;
    whatsappNumber?: string;
  } | null>(null);
  const [instagramUsername, setInstagramUsername] = useState<string | undefined>(undefined);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bidId, setBidId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRepeatBidder, setIsRepeatBidder] = useState(false);
  const [isCheckingPreviousBids, setIsCheckingPreviousBids] = useState(false);
  const [paymentAutoConfirmed, setPaymentAutoConfirmed] = useState(false);
  const [savedCardLast4, setSavedCardLast4] = useState<string | null>(null);
  const [preloadedSetupIntent, setPreloadedSetupIntent] = useState<{
    clientSecret: string;
    setupIntentId: string;
    customerId: string;
    guestBidderId: string;
  } | null>(null);
  const [preloadedPaymentIntent, setPreloadedPaymentIntent] = useState<{
    clientSecret: string;
    paymentIntentId: string;
    customerId: string;
    guestBidderId: string;
  } | null>(null);
  const [isPreloadingSetupIntent, setIsPreloadingSetupIntent] = useState(false);
  const [pendingBidCreation, setPendingBidCreation] = useState<Promise<void> | null>(null);

  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const minimumBid = calculateMinimumBid(currentPrice, startPrice);

  // Check if auction is still active
  const isAuctionActive =
    auction.status === 'active' && new Date(auction.end_time) > new Date();

  // Preload PaymentIntent for instant payment form loading
  // This creates a PaymentIntent with estimated amount (minimumBid) so that
  // Stripe Elements (including Google Pay/Apple Pay) can initialize immediately
  const preloadPaymentIntent = async (email: string, name: string) => {
    if (isPreloadingSetupIntent || preloadedPaymentIntent) return;

    setIsPreloadingSetupIntent(true);
    console.log('[BiddingInterface] 🚀 Preloading PaymentIntent with estimated amount:', {
      email,
      name,
      estimatedAmount: minimumBid,
    });

    try {
      const response = await fetch('/api/stripe/payment-intent-preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auction_id: auction.id,
          bidder_email: email,
          bidder_name: name,
          estimated_amount: minimumBid,
        }),
      });

      const data = await response.json();

      if (data.success && data.client_secret) {
        setPreloadedPaymentIntent({
          clientSecret: data.client_secret,
          paymentIntentId: data.payment_intent_id,
          customerId: data.customer_id,
          guestBidderId: data.guest_bidder_id,
        });
        console.log('[BiddingInterface] ✅ PaymentIntent preloaded successfully:', {
          paymentIntentId: data.payment_intent_id,
          customerId: data.customer_id,
        });
      } else {
        console.error('[BiddingInterface] ❌ Failed to preload PaymentIntent:', data.error);
      }
    } catch (err) {
      console.error('[BiddingInterface] ❌ Error preloading PaymentIntent:', err);
    } finally {
      setIsPreloadingSetupIntent(false);
    }
  };

  // Preload PaymentIntent when entering guest_info step (for guests)
  // This gives us 3-5 seconds headstart while user fills Instagram form
  useEffect(() => {
    if (step === 'guest_info' && guestInfo && !preloadedPaymentIntent && !isPreloadingSetupIntent) {
      const email = guestInfo.contactMethod === 'email'
        ? guestInfo.email
        : `whatsapp:${guestInfo.whatsappNumber}`;
      if (email) {
        console.log('[BiddingInterface] 🚀 Early preload: Starting PaymentIntent at guest_info step');
        preloadPaymentIntent(email, guestInfo.name);
      }
    }
  }, [step, guestInfo, preloadedPaymentIntent, isPreloadingSetupIntent]);

  // Preload PaymentIntent for logged-in users at amount step (they skip guest_info)
  useEffect(() => {
    if (step === 'amount' && userEmail && userName && !preloadedPaymentIntent && !isPreloadingSetupIntent) {
      console.log('[BiddingInterface] 🚀 Early preload: Starting PaymentIntent for logged-in user');
      preloadPaymentIntent(userEmail, userName);
    }
  }, [step, userEmail, userName, preloadedPaymentIntent, isPreloadingSetupIntent]);

  // Preload PaymentIntent for cached guest users at amount step (they skip guest_info)
  useEffect(() => {
    if (step === 'amount' && !userEmail && guestInfo && !preloadedPaymentIntent && !isPreloadingSetupIntent) {
      const email = guestInfo.contactMethod === 'email'
        ? guestInfo.email
        : `whatsapp:${guestInfo.whatsappNumber}`;
      if (email) {
        console.log('[BiddingInterface] 🚀 Early preload: Starting PaymentIntent for cached guest user at amount step');
        preloadPaymentIntent(email, guestInfo.name);
      }
    }
  }, [step, userEmail, guestInfo, preloadedPaymentIntent, isPreloadingSetupIntent]);

  // Safety trigger: Ensure preload starts at Instagram step if not already started
  useEffect(() => {
    if (step === 'instagram' && !userEmail && guestInfo && !preloadedPaymentIntent && !isPreloadingSetupIntent) {
      const email = guestInfo.contactMethod === 'email'
        ? guestInfo.email
        : `whatsapp:${guestInfo.whatsappNumber}`;
      if (email) {
        console.log('[BiddingInterface] ⚠️ Safety trigger: Starting PaymentIntent at Instagram step (preload should have started earlier)');
        preloadPaymentIntent(email, guestInfo.name);
      }
    }
  }, [step, userEmail, guestInfo, preloadedPaymentIntent, isPreloadingSetupIntent]);

  // Check for previous bids on mount
  useEffect(() => {
    const checkPreviousBids = async () => {
      if (!userEmail && !guestInfo?.email) return;

      setIsCheckingPreviousBids(true);

      try {
        const email = userEmail || guestInfo?.email;
        if (!email) return;

        const response = await fetch(`/api/auctions/${auction.id}/user-bids?email=${encodeURIComponent(email)}`);

        if (response.ok) {
          const data = await response.json();

          if (data.bids && data.bids.length > 0) {
            // User has bid before on this auction
            setIsRepeatBidder(true);

            // Get Instagram username from most recent bid
            const mostRecentBid = data.bids[0];
            if (mostRecentBid.bidder_instagram_username) {
              setInstagramUsername(mostRecentBid.bidder_instagram_username);
            }
          }
        }
      } catch (err) {
        console.error('Error checking previous bids:', err);
      } finally {
        setIsCheckingPreviousBids(false);
      }
    };

    checkPreviousBids();
  }, [auction.id, userEmail, guestInfo?.email]);

  // Handle bid amount submission
  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseInt(bidAmount.replace(/,/g, ''), 10);

    // Validate amount
    if (isNaN(amount) || amount < minimumBid) {
      setError(`Minimum bid is ${formatBidAmount(minimumBid)}`);
      return;
    }

    // If user is logged in and is a repeat bidder, skip directly to payment
    if (userEmail && userName && isRepeatBidder) {
      // Create bid with saved Instagram username (if any)
      setStep('payment');
      await createBid(userName, 'email', userEmail, undefined, amount, instagramUsername);
      return;
    }

    // If guest info is cached and user is a repeat bidder, skip directly to payment
    if (!userEmail && guestInfo && isRepeatBidder) {
      console.log('✨ [BiddingInterface] Repeat guest bidder detected, skipping forms');
      // Create bid with cached guest info and Instagram username
      setStep('payment');
      await createBid(
        guestInfo.name,
        guestInfo.contactMethod,
        guestInfo.email,
        guestInfo.whatsappNumber,
        amount,
        instagramUsername
      );
      return;
    }

    // If user is logged in, skip guest info step and go to Instagram
    if (userEmail && userName) {
      setStep('instagram');
    } else {
      setStep('guest_info');
    }
  };

  // Handle guest info submission
  const handleGuestInfoSubmit = async (info: {
    name: string;
    contactMethod: 'whatsapp' | 'email';
    email?: string;
    whatsappNumber?: string;
  }) => {
    setGuestInfo(info);

    // Save guest info to localStorage for consecutive bids
    // This ensures the correct format (with combined whatsappNumber) is cached
    try {
      const cacheKey = `decode_guest_bidder_${auction.id}`;
      localStorage.setItem(cacheKey, JSON.stringify(info));
      console.log('💾 [BiddingInterface] Saved guest info to cache');
    } catch (error) {
      console.error('Error saving guest info to cache:', error);
    }

    // Trigger preload immediately with new guest info (before checking previous bids)
    const preloadEmail = info.contactMethod === 'email'
      ? info.email
      : `whatsapp:${info.whatsappNumber}`;
    if (preloadEmail && !preloadedPaymentIntent && !isPreloadingSetupIntent) {
      console.log('[BiddingInterface] 🚀 Triggering preload in handleGuestInfoSubmit');
      preloadPaymentIntent(preloadEmail, info.name);
    }

    // Check if this guest has bid before on this auction
    const email = info.contactMethod === 'email' ? info.email : `whatsapp:${info.whatsappNumber}`;
    if (email) {
      try {
        const response = await fetch(`/api/auctions/${auction.id}/user-bids?email=${encodeURIComponent(email)}`);
        if (response.ok) {
          const data = await response.json();

          if (data.bids && data.bids.length > 0) {
            // Guest has bid before - use saved Instagram and skip to payment
            setIsRepeatBidder(true);

            const mostRecentBid = data.bids[0];
            const savedInstagram = mostRecentBid.bidder_instagram_username;
            setInstagramUsername(savedInstagram);

            // Skip Instagram step and go directly to payment
            const amount = parseFloat(bidAmount.replace(/,/g, ''));
            await createBid(info.name, info.contactMethod, info.email, info.whatsappNumber, amount, savedInstagram);
            return;
          }
        }
      } catch (err) {
        console.error('Error checking guest previous bids:', err);
      }
    }

    // New guest bidder - show Instagram form
    setStep('instagram');
  };

  // Handle Instagram username submission
  const handleInstagramSubmit = async (username?: string) => {
    const perfStart = performance.now();
    console.log('[PERF] Instagram submit started');

    setInstagramUsername(username);
    const amount = parseFloat(bidAmount.replace(/,/g, ''));

    // Get bidder info (either from guestInfo or logged-in user)
    const name = guestInfo?.name || userName!;
    const contactMethod = guestInfo?.contactMethod || 'email';
    const email = guestInfo?.email || userEmail;
    const whatsappNumber = guestInfo?.whatsappNumber;

    // OPTIMIZATION: Don't wait for preload - proceed immediately to payment step
    // The payment step will handle showing loading state if preload is still in progress
    console.log('[BiddingInterface] Proceeding to payment step without blocking wait', {
      isPreloading: isPreloadingSetupIntent,
      hasPreloadedIntent: !!preloadedPaymentIntent
    });

    console.log(`[PERF] Moving to payment step: ${performance.now() - perfStart}ms`);

    // Move to payment step immediately
    setStep('payment');

    // Create bid with preloaded PaymentIntent if available
    if (preloadedPaymentIntent) {
      console.log('[BiddingInterface] 💚 Using preloaded PaymentIntent for instant payment form');
      console.log(`[PERF] Starting bid creation (with preloaded intent): ${performance.now() - perfStart}ms`);
      await createBid(name, contactMethod, email, whatsappNumber, amount, username, preloadedPaymentIntent.paymentIntentId);
      console.log(`[PERF] Bid created: ${performance.now() - perfStart}ms`);
    } else {
      console.log('[BiddingInterface] ⚠️ No preloaded PaymentIntent, using fallback flow');
      console.log(`[PERF] Starting bid creation (fallback): ${performance.now() - perfStart}ms`);
      await createBid(name, contactMethod, email, whatsappNumber, amount, username);
      console.log(`[PERF] Bid created: ${performance.now() - perfStart}ms`);
    }
  };

  // Create bid and get payment intent
  const createBid = async (
    name: string,
    contactMethod: 'whatsapp' | 'email',
    email?: string,
    whatsappNumber?: string,
    amount?: number,
    instagram?: string,
    paymentIntentId?: string
  ) => {
    setIsProcessing(true);
    setError(null);

    const finalAmount = amount || parseFloat(bidAmount.replace(/,/g, ''));

    // Note: Server validates bid amount against current price
    // If price has changed, server will return an error which we handle below

    const bidData: any = {
      bidder_name: name,
      contact_method: contactMethod,
      bid_amount: finalAmount,
    };

    // Pass payment_intent_id if using preloaded PaymentIntent
    if (paymentIntentId) {
      bidData.payment_intent_id = paymentIntentId;
      console.log('[BiddingInterface] 💎 Using preloaded PaymentIntent:', paymentIntentId);
    }

    // Add Instagram username if provided
    if (instagram) {
      bidData.bidder_instagram_username = instagram;
    }

    // Add contact info based on method
    if (contactMethod === 'email' && email) {
      bidData.bidder_email = email;
    } else if (contactMethod === 'whatsapp' && whatsappNumber) {
      bidData.whatsapp_number = whatsappNumber;
      // Still set bidder_email to whatsapp number for backward compatibility
      bidData.bidder_email = `whatsapp:${whatsappNumber}`;
    }

    try {
      const response = await fetch(`/api/auctions/${auction.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bidData),
      });

      const data = await response.json();

      console.log('[BiddingInterface] Received API response:', {
        success: data.success,
        bid_id: data.bid_id,
        has_client_secret: !!data.client_secret,
        payment_auto_confirmed: data.payment_auto_confirmed,
        saved_card_last4: data.saved_card_last4,
        full_response: data,
      });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bid');
      }

      // Store saved card info if present
      if (data.saved_card_last4) {
        setSavedCardLast4(data.saved_card_last4);
      }

      // Check if payment was auto-confirmed with saved payment method
      if (data.payment_auto_confirmed) {
        console.log('[BiddingInterface] ✅ Payment auto-confirmed with saved card:', {
          bid_id: data.bid_id,
          saved_card_last4: data.saved_card_last4,
          browser: typeof navigator !== 'undefined' && navigator.userAgent.includes('Edg') ? 'Edge' : 'Other',
          timestamp: new Date().toISOString()
        });
        setPaymentAutoConfirmed(true);
        setBidId(data.bid_id);
        // Step already set to 'payment' optimistically - will show success message
      } else {
        // Validate client secret for new payment
        if (!data.client_secret) {
          throw new Error('Failed to initialize payment. Please try again.');
        }

        // Set client secret and bid ID for Stripe payment
        console.log('[BiddingInterface] ⚠️ No saved payment method, requesting new card:', {
          bid_id: data.bid_id,
          has_client_secret: !!data.client_secret,
          saved_card_last4: data.saved_card_last4,
          browser: typeof navigator !== 'undefined' && navigator.userAgent.includes('Edg') ? 'Edge' : 'Other',
          timestamp: new Date().toISOString()
        });
        setClientSecret(data.client_secret);
        setBidId(data.bid_id);
        setPaymentAutoConfirmed(false);
        // Step already set to 'payment' optimistically - payment form will now render
      }
    } catch (err) {
      console.error('Bid error:', err);
      setError(err instanceof Error ? err.message : 'Failed to place bid');
      setStep('amount'); // Reset to amount step on error
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setStep('amount');
    setBidAmount('');
    setClientSecret(null);
    setBidId(null);
    setError(null);
    setPaymentAutoConfirmed(false);
    setPreloadedSetupIntent(null);
    setPreloadedPaymentIntent(null); // Clear preloaded PaymentIntent for consecutive bids

    // For guest bidders: Load cached data from localStorage
    if (!userEmail) {
      const cachedGuestInfo = loadGuestInfoFromCache(auction.id);
      if (cachedGuestInfo) {
        console.log('💾 [BiddingInterface] Loaded cached guest info for consecutive bid');
        setGuestInfo(cachedGuestInfo);
        // Cache exists = guest has bid before = repeat bidder
        // Set flag immediately (don't wait for async API check)
        setIsRepeatBidder(true);
        console.log('✅ [BiddingInterface] Marked as repeat bidder based on cache');
        // Instagram username will be loaded by the async useEffect check
      } else {
        setGuestInfo(null);
        setInstagramUsername(undefined);
        setIsRepeatBidder(false);
      }
    } else {
      setGuestInfo(null);
      setInstagramUsername(undefined);
    }
  };

  if (!isAuctionActive) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <svg
          className="mx-auto w-12 h-12 text-gray-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="text-gray-600 font-medium">Bidding is closed</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 relative">
      {/* Close button */}
      <button
        onClick={handleReset}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        type="button"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Place Your Bid</h3>

      {/* Step: Enter Bid Amount */}
      {step === 'amount' && (
        <form onSubmit={handleAmountSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">AED</span>
              <input
                type="text"
                id="bid-amount"
                inputMode="numeric"
                value={bidAmount}
                onChange={(e) => {
                  const formatted = formatNumberWithCommas(e.target.value);
                  setBidAmount(formatted);
                  setError(null);
                }}
                className="w-full pl-14 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder={formatNumberWithCommas(Math.floor(minimumBid).toString())}
              />
            </div>
            <p className="mt-1 text-gray-500" style={{ fontSize: '11px' }}>
              Minimum bid: {formatBidAmount(minimumBid)}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || !bidAmount}
            className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </form>
      )}

      {/* Step: Guest Information */}
      {step === 'guest_info' && (
        <div>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              Your bid: <span className="font-semibold">{formatBidAmount(parseFloat(bidAmount.replace(/,/g, '')))}</span>
            </p>
          </div>
          <GuestBidderForm
            auctionId={auction.id}
            onSubmit={handleGuestInfoSubmit}
            onCancel={() => setStep('amount')}
            isLoading={isProcessing}
          />
        </div>
      )}

      {/* Step: Instagram Username */}
      {step === 'instagram' && (
        <div>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              Your bid: <span className="font-semibold">{formatBidAmount(parseFloat(bidAmount.replace(/,/g, '')))}</span>
            </p>
            {guestInfo && (
              <>
                <p className="text-sm text-blue-700 mt-1">
                  Name: <span className="font-semibold">{guestInfo.name}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {guestInfo.contactMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}:
                  <span className="font-semibold ml-1 !no-underline">
                    {guestInfo.contactMethod === 'whatsapp' ? formatWhatsAppNumber(guestInfo.whatsappNumber!) : guestInfo.email}
                  </span>
                </p>
              </>
            )}
          </div>
          <InstagramUsernameForm
            onSubmit={handleInstagramSubmit}
            isLoading={isProcessing || isPreloadingSetupIntent}
          />
        </div>
      )}

      {/* Step: Payment */}
      {step === 'payment' && (bidId || clientSecret) && (
        <div>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              Your bid: <span className="font-semibold">{formatBidAmount(parseFloat(bidAmount.replace(/,/g, '')))}</span>
            </p>
            {guestInfo && (
              <>
                <p className="text-sm text-blue-700 mt-1">
                  Name: <span className="font-semibold">{guestInfo.name}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {guestInfo.contactMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}:
                  <span className="font-semibold ml-1 !no-underline">
                    {guestInfo.contactMethod === 'whatsapp' ? formatWhatsAppNumber(guestInfo.whatsappNumber!) : guestInfo.email}
                  </span>
                </p>
              </>
            )}
            {instagramUsername && (
              <p className="text-sm text-blue-700 mt-1">
                Instagram: <span className="font-semibold">{instagramUsername}</span>
              </p>
            )}
          </div>

          {/* Auto-confirmed payment (saved card used) */}
          {paymentAutoConfirmed ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-700 font-medium">
                    Bid placed successfully with your saved card!
                  </p>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  Your payment method has been authorized. Your bid is now on the leaderboard.
                </p>
              </div>
              <button
                onClick={() => {
                  if (onBidPlaced && bidId) onBidPlaced(bidId);
                  handleReset();
                }}
                className="w-full px-4 py-3 text-base font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Done
              </button>
            </div>
          ) : !clientSecret && !preloadedPaymentIntent && (isProcessing || isPreloadingSetupIntent) ? (
            /* Loading state while payment intent is being created OR preload is completing */
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-blue-700 font-medium">
                    {isPreloadingSetupIntent ? 'Preparing payment form...' : isProcessing ? 'Creating your bid...' : 'Loading payment form...'}
                  </p>
                </div>
              </div>
              {/* Payment form skeleton */}
              <div className="space-y-3 animate-pulse">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : (clientSecret || preloadedPaymentIntent?.clientSecret) ? (
            /* Payment form for new cards */
            <div className="space-y-4">
              {/* Saved card indicator */}
              {savedCardLast4 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6zm2 2a1 1 0 000 2h2a1 1 0 000-2H6zm5 0a1 1 0 000 2h3a1 1 0 000-2h-3z" />
                      </svg>
                      <p className="text-sm text-blue-700 font-medium">
                        💳 Using saved card ending in ****{savedCardLast4}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSavedCardLast4(null)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Use different card
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Click "Confirm Your Bid" to use your saved card, or enter new card details below.
                  </p>
                </div>
              )}

              <Elements stripe={stripePromise} options={{
                clientSecret: preloadedPaymentIntent?.clientSecret || clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                    fontSizeBase: '16px',
                  },
                },
              }}>
                <PaymentForm
                  auctionId={auction.id}
                  bidId={bidId}
                  savedCardLast4={savedCardLast4}
                  pendingBidCreation={pendingBidCreation}
                  onSuccess={() => {
                    if (onBidPlaced && bidId) onBidPlaced(bidId);
                    handleReset();
                  }}
                  onCancel={handleReset}
                />
              </Elements>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Payment Form Component (inside Stripe Elements)
 * Includes Apple Pay/Google Pay support with card fallback
 */
function PaymentForm({
  auctionId,
  bidId,
  savedCardLast4,
  pendingBidCreation,
  onSuccess,
  onCancel,
}: {
  auctionId: string;
  bidId: string | null;
  savedCardLast4?: string | null;
  pendingBidCreation?: Promise<void> | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Device detection for payment capabilities
  const detectPaymentCapabilities = () => {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform || '';

    const isIOS =
      /iPhone|iPad|iPod/.test(userAgent) ||
      /iPhone|iPad|iPod/.test(platform) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const isAndroid = /Android/.test(userAgent);

    return { isIOS, isAndroid };
  };

  // Get ExpressCheckout options based on device
  const getExpressCheckoutOptions = () => {
    const { isIOS, isAndroid } = detectPaymentCapabilities();

    const baseConfig = {
      buttonTheme: {
        applePay: 'black' as const,
        googlePay: 'black' as const,
      },
      buttonType: {
        applePay: 'plain' as const,
        googlePay: 'plain' as const,
      },
    };

    if (isIOS) {
      return {
        ...baseConfig,
        paymentMethods: {
          applePay: 'always' as const,
          googlePay: 'never' as const,
        },
        paymentMethodOrder: ['applePay'],
      };
    } else if (isAndroid) {
      return {
        ...baseConfig,
        paymentMethods: {
          applePay: 'auto' as const,
          googlePay: 'always' as const,
        },
        paymentMethodOrder: ['googlePay', 'applePay'],
      };
    } else {
      return {
        ...baseConfig,
        paymentMethods: {
          applePay: 'auto' as const,
          googlePay: 'always' as const,
        },
        paymentMethodOrder: ['googlePay', 'applePay'],
      };
    }
  };

  // Confirm bid payment after successful authorization
  const confirmBidPayment = async () => {
    try {
      // If bid is still being created in background, wait for it
      if (pendingBidCreation) {
        console.log('[PaymentForm] Waiting for pending bid creation...');
        await pendingBidCreation;
        console.log('[PaymentForm] Bid creation completed');
      }

      // Now bidId should be set
      if (!bidId) {
        throw new Error('Bid creation failed. Please try again.');
      }

      const response = await fetch(`/api/auctions/${auctionId}/bid/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_id: bidId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm payment');
      }

      onSuccess();
    } catch (err) {
      console.error('Error confirming bid payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to confirm payment');
    }
  };

  // Handle Express Checkout (Apple Pay/Google Pay) confirmation
  const handleExpressCheckoutConfirm = async () => {
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
      } else {
        await confirmBidPayment();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle card form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
      } else {
        await confirmBidPayment();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pre-authorization info text */}
      <p className="text-[11px] sm:text-[13px] text-gray-700 text-center py-2">
        We&apos;ll pre-authorize. You&apos;re charged only if you win.
      </p>

      <div className="p-4 bg-gray-50 rounded-md">
        {/* Express Checkout (Apple Pay / Google Pay) */}
        <div className="mb-4" style={{ minHeight: '50px' }}>
          <ExpressCheckoutElement
            options={getExpressCheckoutOptions()}
            onReady={(event) => {
              console.log('Express Checkout ready:', event.availablePaymentMethods);
            }}
            onConfirm={handleExpressCheckoutConfirm}
          />
        </div>

        {/* Divider */}
        <div className="flex items-center my-4">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="px-3 text-sm text-gray-500">or pay with card</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* Card Payment Element */}
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
            wallets: {
              applePay: 'never',
              googlePay: 'never',
            },
            terms: {
              card: 'never',
            },
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || isProcessing}
        className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Confirm Your Bid'}
      </button>
    </div>
  );
}
