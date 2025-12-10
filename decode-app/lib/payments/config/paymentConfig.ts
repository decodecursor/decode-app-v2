/**
 * Payment Configuration
 * Configuration for all payment strategies
 */

export const PAYMENT_CONFIG = {
  // Auction Strategy Configuration
  auction: {
    enabled: true,
    settings: {
      // Pre-authorization settings
      preAuthDuration: 7, // days before pre-auth expires
      simultaneousPreAuths: 2, // Keep top 2 bids pre-authorized

      // Anti-sniping settings
      antiSnipingThreshold: 60, // seconds - if bid in last 60s, extend time
      antiSnipingExtension: 60, // seconds - extend by this amount

      // Bid increment settings (fixed AED amounts)
      minIncrements: {
        under1000: 5, // 5 AED for bids 5-999
        under2500: 10, // 10 AED for bids 1,000-2,499
        under5000: 25, // 25 AED for bids 2,500-4,999
        under10000: 50, // 50 AED for bids 5,000-9,999
        over10000: 100, // 100 AED for bids 10,000+
      },

      // Platform fees
      platformFeePercentage: 10, // 10% fee on auction winnings

      // Video recording settings
      maxVideoDurationSeconds: 10,
      maxRetakes: 1,
      videoExpiryDays: 7,
      recordingTokenExpiryHours: 24,

      // Email notifications
      sendWinnerNotification: true,
      sendOutbidNotification: true,
      sendAuctionEndNotification: true,
    },
  },

  // Fixed Price Strategy Configuration (STAFF/ADMIN - DO NOT MODIFY)
  fixedPrice: {
    enabled: true,
    settings: {
      // This would be for existing payment link functionality
      // Kept separate from auction configuration
    },
  },

  // Global Stripe settings
  stripe: {
    currency: 'usd',
    paymentMethods: ['card'],
    captureMethod: {
      auction: 'manual', // Manual capture for auctions (pre-auth)
      fixedPrice: 'automatic', // Automatic for regular payments
    },
  },

  // Currency conversion (Stripe doesn't support AED directly)
  currency: {
    display: 'AED', // Display currency in UI
    processing: 'usd', // Stripe processing currency
    AED_TO_USD_RATE: 3.67, // 1 USD = 3.67 AED
  },
} as const;

export type PaymentConfig = typeof PAYMENT_CONFIG;

export function getAuctionConfig() {
  return PAYMENT_CONFIG.auction;
}

export function getFixedPriceConfig() {
  return PAYMENT_CONFIG.fixedPrice;
}

export function getStripeConfig() {
  return PAYMENT_CONFIG.stripe;
}
