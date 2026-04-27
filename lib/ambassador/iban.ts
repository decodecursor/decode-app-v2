/**
 * IBAN helpers for the Slice 8 Payout Method flow.
 *
 * Per locked Q1=D for V1: IBAN stays plaintext in the column. Encryption
 * deferred to hardening item 39 (combined post-V1 security retrofit
 * with the legacy /api/user/bank-account endpoint). Compensating
 * controls preserved at the API layer:
 *   - GET /api/ambassador/bank-account NEVER returns the full iban_number,
 *     only iban_last4
 *   - PATCH leaves iban_number unchanged when the body omits it (edit
 *     mode UX: blank field = keep existing — see settings_final_UI_Spec.md §4.6)
 *   - RLS on user_bank_accounts gates SELECT/INSERT/UPDATE/DELETE to the
 *     row owner (auth.uid() = user_id) for any non-service-role caller
 *
 * Validation regex per spec §4.7: basic ISO 13616 shape check
 * (2-letter country + 2 check digits + 4-30 alphanumeric BBAN). Server
 * does the per-country exact-length validation; client is a convenience
 * filter.
 */

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/

/**
 * Strip whitespace + uppercase. IBANs are commonly displayed in 4-char
 * groups (e.g. "AE07 0331 2345 6789 0123 456") — banks print them this
 * way for readability. Normalize before validation + storage.
 */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** Validate normalized IBAN against the spec §4.7 shape regex. */
export function isValidIban(normalized: string): boolean {
  return IBAN_REGEX.test(normalized)
}

/**
 * Last 4 characters of the normalized IBAN (per spec §4.9: stored
 * plaintext for display only, e.g. "•••• 4821"). Caller must pass
 * already-normalized IBAN — this helper does NOT re-strip whitespace
 * to keep the contract explicit.
 */
export function ibanLast4(normalized: string): string {
  return normalized.slice(-4)
}
