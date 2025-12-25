/**
 * Anonymous Payment Preload Hook
 *
 * Preloads a Stripe PaymentIntent immediately on auction page load,
 * BEFORE user identity (email/name) is known.
 *
 * This eliminates the perceived delay when users reach the payment step,
 * making the Google Pay button appear instantly (<500ms).
 *
 * Performance Impact:
 * - Shifts 500-1500ms Stripe API delay into background (during form filling)
 * - Elements mount immediately with clientSecret
 * - Google Pay button renders instantly when payment step loads
 *
 * Cost Impact:
 * - No cost - Stripe PaymentIntents are free to create (only charges when captured)
 *
 * Usage:
 * const { clientSecret, paymentIntentId, isPreloading } = useAnonymousPaymentPreload({
 *   auctionId,
 *   minimumBid,
 *   enabled: true
 * });
 */

import { useEffect, useRef, useState } from 'react';

interface AnonymousPreloadState {
  isPreloading: boolean;
  clientSecret: string | null;
  paymentIntentId: string | null;
  error: string | null;
}

interface UseAnonymousPaymentPreloadOptions {
  auctionId: string;
  estimatedAmount?: number; // Optional - defaults to 500 AED
  enabled?: boolean;
}

export function useAnonymousPaymentPreload({
  auctionId,
  estimatedAmount = 500, // Default estimate in AED
  enabled = true,
}: UseAnonymousPaymentPreloadOptions) {
  const [state, setState] = useState<AnonymousPreloadState>({
    isPreloading: false,
    clientSecret: null,
    paymentIntentId: null,
    error: null,
  });

  // Track if preload has been triggered (single-use per mount)
  const preloadRef = useRef<Promise<void> | null>(null);
  const preloadedRef = useRef<boolean>(false);

  useEffect(() => {
    // Only preload once per mount
    if (!enabled || !auctionId || preloadedRef.current) {
      return;
    }

    // Skip if preload is already in progress
    if (preloadRef.current) {
      return;
    }

    console.log('[useAnonymousPaymentPreload] 🚀 Starting anonymous preload:', {
      auctionId,
      estimatedAmount,
    });

    const preload = async () => {
      setState((prev) => ({ ...prev, isPreloading: true, error: null }));

      const apiStartTime = Date.now();

      try {
        const response = await fetch('/api/stripe/payment-intent-anonymous-preload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auction_id: auctionId,
            estimated_amount: estimatedAmount,
          }),
        });

        const data = await response.json();
        const apiTime = Date.now() - apiStartTime;

        if (data.success && data.client_secret) {
          console.log('[useAnonymousPaymentPreload] ✅ Anonymous preload successful:', {
            payment_intent_id: data.payment_intent_id,
            api_time_ms: apiTime,
          });

          setState({
            isPreloading: false,
            clientSecret: data.client_secret,
            paymentIntentId: data.payment_intent_id,
            error: null,
          });

          // Mark as preloaded
          preloadedRef.current = true;
        } else {
          console.error('[useAnonymousPaymentPreload] ❌ Preload failed:', {
            error: data.error || 'Unknown error',
            api_time_ms: apiTime,
          });

          setState({
            isPreloading: false,
            clientSecret: null,
            paymentIntentId: null,
            error: data.error || 'Preload failed',
          });
        }
      } catch (err) {
        const apiTime = Date.now() - apiStartTime;
        console.error('[useAnonymousPaymentPreload] ❌ Preload error:', {
          error: err,
          api_time_ms: apiTime,
        });

        setState({
          isPreloading: false,
          clientSecret: null,
          paymentIntentId: null,
          error: err instanceof Error ? err.message : 'Preload failed',
        });
      } finally {
        // Clear preload ref after completion
        preloadRef.current = null;
      }
    };

    // Start preload and store promise
    preloadRef.current = preload();
  }, [enabled, auctionId, estimatedAmount]); // Include estimatedAmount to use correct bid amount

  return {
    ...state,
    resetAnonymousPreload: () => {
      setState({
        isPreloading: false,
        clientSecret: null,
        paymentIntentId: null,
        error: null,
      });
      preloadedRef.current = false;
    },
  };
}
