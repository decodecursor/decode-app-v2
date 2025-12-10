/**
 * Consolidated Payment Preload Hook
 *
 * Replaces 4 separate useEffect hooks to eliminate race conditions and duplicate preload calls.
 * Starts preloading PaymentIntent as soon as email + name are available.
 *
 * Performance Impact:
 * - Eliminates duplicate API calls (saves ~500ms from race conditions)
 * - Single source of truth for preload state
 * - Prevents multiple preload triggers from firing simultaneously
 *
 * Usage:
 * const { preloadedData, isPreloading, error } = usePaymentPreload(
 *   auctionId,
 *   email,
 *   name,
 *   estimatedAmount,
 *   enabled
 * );
 */

import { useEffect, useRef, useState } from 'react';

interface PreloadState {
  isPreloading: boolean;
  preloadedData: {
    clientSecret: string;
    paymentIntentId: string;
    customerId: string;
    guestBidderId: string;
  } | null;
  error: string | null;
}

interface UsePaymentPreloadOptions {
  auctionId: string;
  email: string | null;
  name: string | null;
  estimatedAmount: number;
  enabled?: boolean;
}

export function usePaymentPreload({
  auctionId,
  email,
  name,
  estimatedAmount,
  enabled = true,
}: UsePaymentPreloadOptions) {
  const [state, setState] = useState<PreloadState>({
    isPreloading: false,
    preloadedData: null,
    error: null,
  });

  // Track if preload is in progress or completed for this user
  const preloadRef = useRef<Promise<void> | null>(null);
  const preloadedForRef = useRef<string>('');

  useEffect(() => {
    // Only preload once per unique user (email + name combination)
    if (!enabled || !email || !name || !auctionId) {
      return;
    }

    // Create cache key from user identity
    const cacheKey = `${email}-${name}`;

    // Skip if already preloaded for this user
    if (preloadedForRef.current === cacheKey) {
      console.log('[usePaymentPreload] Already preloaded for:', { email, name });
      return;
    }

    // Skip if preload is already in progress
    if (preloadRef.current) {
      console.log('[usePaymentPreload] Preload already in progress, skipping duplicate trigger');
      return;
    }

    console.log('[usePaymentPreload] 🚀 Starting preload for:', { email, name, auctionId, estimatedAmount });

    const preload = async () => {
      setState((prev) => ({ ...prev, isPreloading: true, error: null }));

      const apiStartTime = Date.now();

      try {
        const response = await fetch('/api/stripe/payment-intent-preload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auction_id: auctionId,
            bidder_email: email,
            bidder_name: name,
            estimated_amount: estimatedAmount,
          }),
        });

        const data = await response.json();
        const apiTime = Date.now() - apiStartTime;

        if (data.success && data.client_secret) {
          console.log('[usePaymentPreload] ✅ Preload successful:', {
            email,
            payment_intent_id: data.payment_intent_id,
            customer_id: data.customer_id,
            guest_bidder_id: data.guest_bidder_id,
            api_time_ms: apiTime,
          });

          setState({
            isPreloading: false,
            preloadedData: {
              clientSecret: data.client_secret,
              paymentIntentId: data.payment_intent_id,
              customerId: data.customer_id,
              guestBidderId: data.guest_bidder_id,
            },
            error: null,
          });

          // Mark as preloaded for this user
          preloadedForRef.current = cacheKey;
        } else {
          console.error('[usePaymentPreload] ❌ Preload failed:', {
            email,
            error: data.error || 'Unknown error',
            api_time_ms: apiTime,
          });

          setState({
            isPreloading: false,
            preloadedData: null,
            error: data.error || 'Preload failed',
          });
        }
      } catch (err) {
        const apiTime = Date.now() - apiStartTime;
        console.error('[usePaymentPreload] ❌ Preload error:', {
          email,
          error: err,
          api_time_ms: apiTime,
        });

        setState({
          isPreloading: false,
          preloadedData: null,
          error: err instanceof Error ? err.message : 'Preload failed',
        });
      } finally {
        // Clear preload ref after completion
        preloadRef.current = null;
      }
    };

    // Start preload and store promise
    preloadRef.current = preload();
  }, [enabled, email, name, auctionId, estimatedAmount]);

  return state;
}
