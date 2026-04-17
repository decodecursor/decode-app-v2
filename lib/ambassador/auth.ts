import { createHash } from 'crypto'

// ============================================================================
// AMBASSADOR AUTH — INTERNAL EMAIL PATTERN
//
// Supabase auth requires an email for admin.createUser() and
// admin.generateLink(). For WhatsApp-only users, we generate a deterministic
// internal email from the phone number:
//
//   wa_{sha256(phone).slice(0,12)}@auth.internal
//
// Rules:
//   1. auth.users.email = this internal email (session management only)
//   2. public.users.email  = NULL for WhatsApp-only users
//   3. User NEVER sees this email anywhere in the UI
//   4. Same phone always produces same hash (no timestamps, no randomness)
//   5. Domain "auth.internal" is non-routable (RFC 6761)
//
// Why deterministic?
//   - Returning users must resolve to the SAME auth.users row
//   - No lookup table needed; the phone itself is the key
//   - Avoids the legacy pattern of random timestamps in fake emails
// ============================================================================

/**
 * Convert a phone number (E.164) to a deterministic internal email
 * for Supabase auth session management.
 *
 * Example: +971501234567 → wa_a1b2c3d4e5f6@auth.internal
 */
export function phoneToInternalEmail(phone: string): string {
  const hash = createHash('sha256').update(phone).digest('hex').slice(0, 12)
  return `wa_${hash}@auth.internal`
}

/**
 * Check whether an email is an internal auth email (not a real address).
 * Used to decide whether to show email in UI — these should always be hidden.
 */
export function isInternalEmail(email: string): boolean {
  return email.endsWith('@auth.internal')
}
