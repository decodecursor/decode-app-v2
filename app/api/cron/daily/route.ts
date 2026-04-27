import { NextResponse, type NextRequest } from 'next/server'
import { sendListingExpiringNotifications } from '@/lib/ambassador/cron-helpers'

export const runtime = 'nodejs'

/**
 * GET /api/cron/daily
 *
 * Single Vercel cron handler for ambassador time-based checks.
 * Runs daily at 09:00 UTC (13:00 Dubai). Designed extensibly:
 * future time-based checks land as additional awaited helper
 * calls inside this handler — do NOT add new cron entries to
 * vercel.json for ambassador-side checks.
 *
 * Auth: accepts requests where x-vercel-cron header is present
 * (sent by the Vercel cron scheduler) OR the Authorization
 * header carries `Bearer ${CRON_SECRET}` (manual trigger /
 * smoke test). Anything else → 401.
 *
 * Each helper is wrapped so a failure in one does not block the
 * next. Returns a JSON summary keyed by helper name.
 */
export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get('x-vercel-cron') !== null
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isBearer = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isVercelCron && !isBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary: Record<string, { sent: number; errors: number }> = {}

  try {
    summary.listing_expiring = await sendListingExpiringNotifications()
  } catch (err) {
    console.error('[cron/daily] listing_expiring threw', err)
    summary.listing_expiring = { sent: 0, errors: 1 }
  }

  // Future ambassador time-based helpers go here, each in its own
  // try/catch so a failing helper does not block the next:
  //   try { summary.<helper_key> = await <helperFn>() }
  //   catch (err) { console.error(...); summary.<helper_key> = { sent: 0, errors: 1 } }

  return NextResponse.json(summary)
}
