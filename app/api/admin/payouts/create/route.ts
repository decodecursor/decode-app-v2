import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { requireAdmin } from '@/lib/ambassador/admin-auth'

/**
 * POST /api/admin/payouts/create
 *
 * Body: { model_id: uuid }
 *
 * Calls the schema-side create_payout_batch() RPC (Slice 6 locked
 * decision #3) — atomic batching at the row-lock layer. The RPC:
 *   - Returns 0 rows when no unbatched payments exist (no INSERT)
 *   - Returns a row with possibly-zero counts under a race; this
 *     endpoint then DELETEs the orphan per decision F (empty-payout
 *     cleanup app-side post-RPC)
 *   - RAISEs on missing primary bank account or mixed currencies
 *
 * Auth: requireAdmin (auth.getUser + users.role='Admin' check), the
 * sound pattern per locked decision #2 — NOT the ?adminUserId
 * query-param gate from /api/admin/transfers (hardening item 29).
 */

interface CreateBody {
  model_id?: string
}

interface BatchResult {
  payout_id: string
  payout_reference: string
  listings_count: number
  wishes_count: number
  gross_total: number | string
  platform_fee_total: number | string
  net_total: number | string
  currency: string
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (gate instanceof NextResponse) return gate

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const modelId = body.model_id
  if (!modelId || typeof modelId !== 'string') {
    return NextResponse.json({ error: 'model_id required' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  const { data, error } = await admin.rpc('create_payout_batch', { model_id_in: modelId })

  if (error) {
    // RPC raises with error codes for actionable failures:
    //   no_data_found  → no primary bank OR profile not found
    //   data_exception → mixed currencies in unbatched payments
    const code = (error as { code?: string }).code
    if (code === 'no_data_found') {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    if (code === 'data_exception') {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Batch failed', detail: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as BatchResult[]

  // No unbatched payments → RPC returned 0 rows, no INSERT performed.
  if (rows.length === 0) {
    return NextResponse.json({
      batched: false,
      reason: 'no_unbatched_payments',
    })
  }

  const result = rows[0]
  const totalCount = result.listings_count + result.wishes_count

  // Orphan cleanup: race-condition path where RPC inserted a payout but
  // both UPDATE-RETURNING blocks updated 0 rows (concurrent batch claimed
  // the payments first). Per decision F, DELETE the empty row.
  if (totalCount === 0) {
    await admin.from('model_payouts').delete().eq('id', result.payout_id)
    return NextResponse.json({
      batched: false,
      reason: 'race_lost_to_concurrent_batch',
    })
  }

  return NextResponse.json({
    batched: true,
    payout_id: result.payout_id,
    payout_reference: result.payout_reference,
    listings_count: result.listings_count,
    wishes_count: result.wishes_count,
    gross_total: Number(result.gross_total),
    platform_fee_total: Number(result.platform_fee_total),
    net_total: Number(result.net_total),
    currency: result.currency,
  })
}
