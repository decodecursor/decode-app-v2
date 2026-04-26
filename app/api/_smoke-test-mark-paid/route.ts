/**
 * ⚠️  TEMPORARY SMOKE TEST ENDPOINT — DELETE IN SLICE 7C.
 *
 * Do NOT invoke from production code. This endpoint exists solely so
 * the Slice 7B end-to-end notification smoke test (per
 * docs/slice-7b-smoke-test.md) can curl the mark-paid flow with a
 * service-role Bearer token instead of capturing browser cookies.
 *
 * Tracked for hard-deletion: docs/slice-7c-cleanup.md.
 *
 * Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>. The
 * service-role key is the same one wired into Vercel env for backend
 * Supabase admin access. Comparison is against
 * process.env.SUPABASE_SERVICE_ROLE_KEY, NOT the public anon key.
 *
 * Body: { payout_id: string }
 *
 * Behavior: identical to /api/admin/payouts/[id]/mark-paid downstream
 * — both routes call markPayoutAsPaid() so the smoke test exercises
 * the real notification fire (Resend + AUTHKey), not a copy.
 *
 * Once smoke test passes and Slice 7C opens, this file + the
 * containing _smoke-test-mark-paid directory must be deleted, and
 * the deletion confirmed via grep for `_smoke-test-mark-paid` returning
 * zero hits across the repo.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { markPayoutAsPaid } from '@/lib/ambassador/mark-payout-paid'

interface SmokeTestBody {
  payout_id?: string
}

export async function POST(req: NextRequest) {
  // Service-role bearer auth. Compare against the secret service key,
  // NOT the public anon key. If env is unset (e.g. preview without
  // secrets), fail closed with 500 so the absence is loud.
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!expected) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY env not configured' },
      { status: 500 },
    )
  }

  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = auth.slice('Bearer '.length).trim()
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SmokeTestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.payout_id || typeof body.payout_id !== 'string') {
    return NextResponse.json({ error: 'payout_id required' }, { status: 400 })
  }

  const result = await markPayoutAsPaid(body.payout_id)
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  }

  return NextResponse.json({
    success: true,
    payout_id: result.payoutId,
    status: result.status,
    paid_at: result.paidAt,
    smoke_test: true,
  })
}
