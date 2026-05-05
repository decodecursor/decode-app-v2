// Pre-launch beta gate. Set to `true` once Stripe live mode is
// provisioned (bank-account setup complete) to re-enable the
// customer-side payment modal on both checkout flows. No other
// code changes needed for reversal.
export const PAYMENTS_ENABLED = false as const
export const BETA_TOAST_MESSAGE = 'Coming soon — payments launching shortly'
