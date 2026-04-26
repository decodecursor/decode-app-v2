import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/ambassador/admin-auth'
import { markPayoutAsPaid } from '@/lib/ambassador/mark-payout-paid'

/**
 * PATCH /api/admin/payouts/[id]/mark-paid
 *
 * Flips a payout from pending/processing → paid and stamps paid_at.
 * Fires email + WhatsApp notifications (Slice 7B real-Resend +
 * AUTHKey wire). Notification calls are fire-and-forget — failure
 * to notify never blocks the status flip.
 *
 * Auth: requireAdmin (auth.getUser + users.role='Admin' check), the
 * sound pattern per locked decision #2 — NOT the ?adminUserId
 * query-param gate from /api/admin/transfers (hardening item 29).
 *
 * Slice 7B refactor: the read → status-gate → UPDATE → fire-
 * notifications sequence is extracted to lib/ambassador/mark-payout-
 * paid.ts so the temporary smoke-test endpoint can hit the same
 * downstream code without copy-pasting.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const gate = await requireAdmin(req)
  if (gate instanceof NextResponse) return gate

  const result = await markPayoutAsPaid(id)
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  }

  return NextResponse.json({
    success: true,
    payout_id: result.payoutId,
    status: result.status,
    paid_at: result.paidAt,
  })
}
