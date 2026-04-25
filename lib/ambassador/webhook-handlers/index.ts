/**
 * Per-event handlers for /api/webhooks/ambassador-stripe.
 *
 * Aggregates the listing-flow handlers (carved out at start of Slice 5C)
 * + wish-flow handlers (added in Slice 5C-2). Each handler defensively
 * no-ops on metadata.kind it doesn't own, so the route can call them
 * unconditionally per Stripe event type without per-kind dispatch logic
 * (though Slice 5C-2 will add explicit dispatch for clarity).
 */

export {
  handleListingPaymentSucceeded,
  handleListingPaymentFailed,
  handleListingChargeRefunded,
} from './listing'

export {
  handleWishPaymentSucceeded,
  handleWishPaymentFailed,
  handleWishChargeRefunded,
} from './wish'
