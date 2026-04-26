import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '@/lib/ambassador/admin-auth'
import {
  sendPayoutPaidEmail,
  sendPayoutPaidWhatsApp,
} from '@/lib/ambassador/notification-stubs'

/**
 * PATCH /api/admin/payouts/[id]/mark-paid
 *
 * Flips a payout from pending/processing → paid and stamps paid_at.
 * Fires email + WhatsApp notification stubs (decision #4: trigger
 * sites land in 6B, real Resend/AUTHKey copy lands in Slice 7
 * polish). Notification calls are fire-and-forget — failure to
 * notify never blocks the status flip.
 *
 * Auth: requireAdmin (sound pattern per locked decision #2). The
 * status transition is gated to pending → paid OR processing → paid;
 * marking-paid an already-paid or failed row returns 409.
 */

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireAdmin(req)
  if (gate instanceof NextResponse) return gate

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
    .eq('id', id)
    .maybeSingle<PayoutRow>()

  if (readErr) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
  }

  // Status gate: only pending or processing → paid is valid. Already-paid
  // or failed payouts can't be re-marked here (admin would need a
  // separate undo endpoint, out of 6B scope).
  if (payout.status !== 'pending' && payout.status !== 'processing') {
    return NextResponse.json(
      { error: `Cannot mark-paid from status '${payout.status}'` },
      { status: 409 },
    )
  }

  const now = new Date()
  const { error: updateErr } = await admin
    .from('model_payouts')
    .update({
      status: 'paid',
      paid_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    // Concurrency guard: only flip if status hasn't changed since read.
    // If a parallel admin click already marked-paid we get 0 rows
    // updated; surface as success since the desired end-state holds.
    .in('status', ['pending', 'processing'])

  if (updateErr) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Fire notification stubs (Slice 6B-2 wiring; real copy in Slice 7).
  // Read ambassador contact info — fire-and-forget so notification
  // failures never bubble back to the admin caller.
  if (payout.model?.user_id) {
    void admin
      .from('users')
      .select('id, email, phone')
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

  return NextResponse.json({
    success: true,
    payout_id: id,
    status: 'paid',
    paid_at: now.toISOString(),
  })
}
