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

interface BiddingInterfaceProps {
  auction: Auction;
  userEmail?: string;
  userName?: string;
  onBidPlaced?: () => void;
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

  const currentPrice = Number(auction.auction_current_price);
  const startPrice = Number(auction.auction_start_price);
  const minimumBid = calculateMinimumBid(currentPrice, startPrice);

  // Check if auction is still active
  const isAuctionActive =
    auction.status === 'active' && new Date(auction.end_time) > new Date();

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

    const amount = parseFloat(bidAmount);

    // Validate amount
    if (isNaN(amount) || amount < minimumBid) {
      setError(`Minimum bid is ${formatBidAmount(minimumBid)}`);
      return;
    }

    // If user is logged in and is a repeat bidder, skip directly to payment
    if (userEmail && userName && isRepeatBidder) {
      // Create bid with saved Instagram username (if any)
      await createBid(userName, 'email', userEmail, undefined, amount, instagramUsername);
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
            const amount = parseFloat(bidAmount);
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
    setInstagramUsername(username);
    const amount = parseFloat(bidAmount);

    // Get bidder info (either from guestInfo or logged-in user)
    const name = guestInfo?.name || userName!;
    const contactMethod = guestInfo?.contactMethod || 'email';
    const email = guestInfo?.email || userEmail;
    const whatsappNumber = guestInfo?.whatsappNumber;

    await createBid(name, contactMethod, email, whatsappNumber, amount, username);
  };

  // Create bid and get payment intent
  const createBid = async (
    name: string,
    contactMethod: 'whatsapp' | 'email',
    email?: string,
    whatsappNumber?: string,
    amount?: number,
    instagram?: string
  ) => {
    setIsProcessing(true);
    setError(null);

    const finalAmount = amount || parseFloat(bidAmount);

    // Fetch fresh auction data to prevent stale price issues
    try {
      const freshAuctionResponse = await fetch(`/api/auctions/${auction.id}`);
      if (!freshAuctionResponse.ok) {
        throw new Error('Failed to fetch current auction data');
      }
      const freshAuctionData = await freshAuctionResponse.json();
      const freshAuction = freshAuctionData.auction;

      // Re-validate bid amount against fresh current price
      const freshCurrentPrice = Number(freshAuction.auction_current_price);
      const freshStartPrice = Number(freshAuction.auction_start_price);
      const freshMinBid = calculateMinimumBid(freshCurrentPrice, freshStartPrice);

      if (finalAmount < freshMinBid) {
        setError(`Bid too low. Current minimum bid is ${formatBidAmount(freshMinBid)}. The auction price has changed.`);
        setStep('amount');
        setIsProcessing(false);
        return;
      }
    } catch (err) {
      console.error('Error fetching fresh auction data:', err);
      setError('Failed to validate bid. Please try again.');
      setStep('amount');
      setIsProcessing(false);
      return;
    }

    const bidData: any = {
      bidder_name: name,
      contact_method: contactMethod,
      bid_amount: finalAmount,
    };

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
      console.log('Bid API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place bid');
      }

      if (!data.client_secret) {
        throw new Error('Failed to initialize payment. Please try again.');
      }

      // Set client secret and bid ID for Stripe payment
      setClientSecret(data.client_secret);
      setBidId(data.bid_id);
      setStep('payment');
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
    setGuestInfo(null);
    setInstagramUsername(undefined);
    setClientSecret(null);
    setBidId(null);
    setError(null);
  };

  if (!isAuctionActive) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <svg
          className="mx-auto w-12 h-12 text-gray-400 mb-3"
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
        <p className="text-sm text-gray-500 mt-1">This auction has ended</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Place Your Bid</h3>

      {/* Step: Enter Bid Amount */}
      {step === 'amount' && (
        <form onSubmit={handleAmountSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">AED</span>
              <input
                type="number"
                id="bid-amount"
                value={bidAmount}
                onChange={(e) => {
                  setBidAmount(e.target.value);
                  setError(null);
                }}
                min={minimumBid}
                step="0.01"
                className="w-full pl-14 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder={minimumBid.toString()}
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
              Your bid: <span className="font-semibold">{formatBidAmount(parseFloat(bidAmount))}</span>
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
              Your bid: <span className="font-semibold">{formatBidAmount(parseFloat(bidAmount))}</span>
            </p>
            {guestInfo && (
              <>
                <p className="text-sm text-blue-700 mt-1">
                  Name: <span className="font-semibold">{guestInfo.name}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {guestInfo.contactMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}:
                  <span className="font-semibold ml-1 no-underline">
                    {guestInfo.contactMethod === 'whatsapp' ? guestInfo.whatsappNumber : guestInfo.email}
                  </span>
                </p>
              </>
            )}
          </div>
          <InstagramUsernameForm
            onSubmit={handleInstagramSubmit}
            onSkip={() => handleInstagramSubmit(undefined)}
            isLoading={isProcessing}
          />
        </div>
      )}

      {/* Step: Payment */}
      {step === 'payment' && clientSecret && bidId && (
        <div>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              Your bid: <span className="font-semibold">{formatBidAmount(parseFloat(bidAmount))}</span>
            </p>
            {guestInfo && (
              <>
                <p className="text-sm text-blue-700 mt-1">
                  Name: <span className="font-semibold">{guestInfo.name}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {guestInfo.contactMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}:
                  <span className="font-semibold ml-1 no-underline">
                    {guestInfo.contactMethod === 'whatsapp' ? guestInfo.whatsappNumber : guestInfo.email}
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

          <Elements stripe={stripePromise} options={{
            clientSecret,
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
              onSuccess={() => {
                if (onBidPlaced) onBidPlaced();
                handleReset();
              }}
              onCancel={handleReset}
            />
          </Elements>
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
  onSuccess,
  onCancel,
}: {
  auctionId: string;
  bidId: string;
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
      <div className="p-4 bg-gray-50 rounded-md">
        <p className="text-[11px] sm:text-[13px] text-gray-700 mb-3 text-center">
          We&apos;ll pre-authorize. You&apos;re charged only if you win.
        </p>

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
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-3 text-base font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Confirm Bid'}
        </button>
      </div>
    </div>
  );
}
