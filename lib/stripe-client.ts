/**
 * Centralized Stripe Client
 *
 * Single source of truth for Stripe.js loading.
 * This ensures Stripe is loaded only once and can be preloaded early.
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';

// Singleton pattern - Stripe.js loads once when this module is first imported
// The Promise is cached and reused across all components
export const stripePromise: Promise<Stripe | null> = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

/**
 * Call this early (e.g., on auction page mount) to trigger Stripe.js download
 * before the user reaches the payment step.
 *
 * Simply accessing stripePromise triggers the load - this function
 * makes the intent explicit and can be called from useEffect.
 */
export function preloadStripe(): void {
  // Accessing the promise triggers Stripe.js download
  // No need to await - we just want to start the download
  stripePromise;
}

/**
 * For components that need to wait for Stripe to be ready
 */
export async function getStripe(): Promise<Stripe | null> {
  return stripePromise;
}
