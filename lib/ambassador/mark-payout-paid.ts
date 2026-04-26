/**
 * Shared mark-payout-paid helper.
 *
 * Encapsulates the read → status-gate → UPDATE → fire-notifications
 * sequence so both the production admin endpoint
 * (/api/admin/payouts/[id]/mark-paid, cookie-gated via requireAdmin)
 * and the temporary Slice 7B smoke-test endpoint
 * (/api/smoke-test-mark-paid, service-role-bearer-gated) hit the
 * same downstream code path.
 *
 * Rationale: the smoke test must exercise the REAL notification fire
 * (Resend + AUTHKey via lib/ambassador/notification-stubs) — copying
 * the route logic into the smoke endpoint would split the surface
 * being tested from the production code that ships. Extracting once
 * keeps both routes thin and guarantees parity.
 *
 * Fire-and-forget notifications (existing contract preserved): caller
 * does NOT await the notification dispatch; failures log but never
 * affect the success/failure of the mark-paid result. The real-money
 * UPDATE has already committed by the time the notification dispatch
 * fires.
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  sendPayoutPaidEmail,
  sendPayoutPaidWhatsApp,
} from '@/lib/ambassador/notification-stubs'

interface PayoutRow {
  id: string
  payout_reference: string
  net_total: number | string
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed'
  bank_name: string
  bank_last4: string
  listings_count: number
  wishes_count: number
  model: {
    user_id: string
    first_name: string
  } | null
}

interface UserContact {
  id: string
  email: string | null
  phone: string | null
}

export type MarkPayoutPaidResult =
  | { ok: true; payoutId: string; status: 'paid'; paidAt: string }
  | { ok: false; httpStatus: number; error: string }

export async function markPayoutAsPaid(payoutId: string): Promise<MarkPayoutPaidResult> {
  const admin = createServiceRoleClient()

  // Read the row first so we can fire notifications post-update with the
  // ambassador's contact info. Single round-trip joins to model_profiles.
  const { data: payout, error: readErr } = await admin
    .from('model_payouts')
    .select(`
      id, payout_reference, net_total, currency, status, bank_name, bank_last4,
      listings_count, wishes_count,
      model:model_profiles!model_payouts_model_id_fkey ( user_id, first_name )
    `)
    .eq('id', payoutId)
    .maybeSingle<PayoutRow>()

  if (readErr) {
    return { ok: false, httpStatus: 500, error: 'Lookup failed' }
  }
  if (!payout) {
    return { ok: false, httpStatus: 404, error: 'Payout not found' }
  }

  // Status gate: only pending or processing → paid is valid. Already-paid
  // or failed payouts can't be re-marked here (admin would need a
  // separate undo endpoint, out of 6B scope).
  if (payout.status !== 'pending' && payout.status !== 'processing') {
    return { ok: false, httpStatus: 409, error: `Cannot mark-paid from status '${payout.status}'` }
  }

  const now = new Date()
  const { error: updateErr } = await admin
    .from('model_payouts')
    .update({
      status: 'paid',
      paid_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', payoutId)
    // Concurrency guard: only flip if status hasn't changed since read.
    // If a parallel admin click already marked-paid we get 0 rows
    // updated; surface as success since the desired end-state holds.
    .in('status', ['pending', 'processing'])

  if (updateErr) {
    return { ok: false, httpStatus: 500, error: 'Update failed' }
  }

  // Fire notification stubs (Slice 6B-2 wiring; real Resend + AUTHKey
  // calls in Slice 7B). Read ambassador contact info — fire-and-forget
  // so notification failures never bubble back to the caller.
  if (payout.model?.user_id) {
    void admin
      .from('users')
      // Column is `phone_number` on public.users; PostgREST alias maps
      // it to `phone` for the typed UserContact interface here. Pre-7B
      // bug: the original Slice 6B-2 mark-paid SELECT read 'phone'
      // verbatim — column doesn't exist, PostgREST returned undefined,
      // every payout WhatsApp silently skipped. Alias fixes it.
      .select('id, email, phone:phone_number')
      .eq('id', payout.model.user_id)
      .maybeSingle<UserContact>()
      .then(({ data: contact }) => {
        if (!contact) return
        const ambassadorName = payout.model?.first_name ?? 'there'
        if (contact.email) {
          void sendPayoutPaidEmail({
            ambassadorEmail: contact.email,
            ambassadorName,
            payoutId: payout.id,
            payoutReference: payout.payout_reference,
            netAmount: Number(payout.net_total),
            currency: payout.currency,
            bankName: payout.bank_name,
            bankLast4: payout.bank_last4,
            paidAt: now,
            listingsCount: payout.listings_count,
            wishesCount: payout.wishes_count,
          })
        }
        void sendPayoutPaidWhatsApp({
          ambassadorPhone: contact.phone,
          firstName: ambassadorName,
          payoutReference: payout.payout_reference,
          netAmount: Number(payout.net_total),
          currency: payout.currency,
          paidAt: now,
        })
      })
  }

  return {
    ok: true,
    payoutId,
    status: 'paid',
    paidAt: now.toISOString(),
  }
}
