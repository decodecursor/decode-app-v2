import { NextRequest, NextResponse } from 'next/server'
import { isbot } from 'isbot'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { createClient } from '@/utils/supabase/server'
import { analyticsLimiter } from '@/lib/ambassador/rate-limit'
import { getClientIp } from '@/lib/server/ip'
import {
  readSessionId,
  createSessionId,
  setSessionCookie,
  hashIp,
  detectDevice,
} from '@/lib/analytics/session'

/**
 * POST /api/analytics/track
 *
 * Fire-and-forget public analytics endpoint. Writes to
 * model_analytics_events per the DB CHECK enum. Discriminated server-side
 * by event_type (Pattern 3 — one multi-event endpoint).
 *
 * Body: { event_type, slug, target_id?, referrer?, utm_params? }
 *
 * Gating (cheap → expensive, silent-succeed on every non-malformed branch):
 *   1. Body shape + event_type in 4D whitelist
 *   2. Bot UA filter (isbot npm)
 *   3. Rate-limit by IP+event_type (analyticsLimiter: 1/30s)
 *   4. Slug → model_profiles.id lookup
 *   5. Ambassador self-view skip (authed user owns the profile)
 *   6. Insert model_analytics_events row
 *
 * Response policy: 200 for everything EXCEPT malformed body or unknown
 * event_type (those return 400 as programming-error signal). All other
 * branches silently 200 so bots/scrapers can't distinguish "accepted"
 * from "dropped" — defense against targeted enumeration.
 */

// Slice 5D extends to all 7 values in the DB CHECK enum. Wish-side
// events were reserved in the schema (Slice 1) but only wired into the
// allowlist here once the corresponding UI surfaces shipped (5D-1
// rendered the wishes + Wall of Love sections; 5D-2 wires the click
// handlers). Pattern 3 (single multi-event endpoint) doctrine —
// extending the Set is the canonical way to opt-in new event types.
const ALLOWED_EVENT_TYPES = new Set([
  'public_page_view',
  'listing_instagram_click',
  'listing_media_click',
  'public_page_share_click',
  'wish_giftit_click',
  'wish_instagram_click',
  'wall_of_love_instagram_click',
])

type TrackRequest = {
  event_type?: unknown
  slug?: unknown
  target_id?: unknown
  referrer?: unknown
  utm_params?: unknown
}

function silentOk(sessionId: string, wasCreated: boolean): NextResponse {
  const res = NextResponse.json({ ok: true })
  if (wasCreated) setSessionCookie(res, sessionId)
  return res
}

export async function POST(request: NextRequest) {
  let body: TrackRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { event_type, slug, target_id, referrer, utm_params } = body
  if (typeof event_type !== 'string' || !ALLOWED_EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 })
  }
  if (typeof slug !== 'string' || !slug) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 })
  }

  // Session cookie — reuse if present, otherwise generate + set on reply.
  const existingSession = readSessionId(request)
  const sessionId = existingSession ?? createSessionId()
  const sessionWasCreated = !existingSession

  // Bot filter: silent 200, but still set the cookie so subsequent
  // legitimate requests from the same browser share a session (bots
  // rotating through UA strings don't poison cookies).
  const userAgent = request.headers.get('user-agent')
  if (userAgent && isbot(userAgent)) {
    return silentOk(sessionId, sessionWasCreated)
  }

  // Rate-limit keyed per IP+event_type. analyticsLimiter = 1/30s sliding
  // window. 30s-dedup window is spam prevention; true 24h view dedup
  // is a future concern if/when analytics fidelity needs it.
  const ip = getClientIp(request)
  const { success: rlOk } = await analyticsLimiter.limit(`${ip}:${event_type}`)
  if (!rlOk) return silentOk(sessionId, sessionWasCreated)

  const admin = createServiceRoleClient()

  // Slug → model_id. Service-role bypass so suspended profiles still
  // receive analytics (useful if suspension is temporary/accidental).
  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, user_id')
    .eq('slug', slug)
    .maybeSingle<{ id: string; user_id: string }>()
  if (!profile) return silentOk(sessionId, sessionWasCreated)

  // Self-view skip — the ambassador viewing her own page shouldn't
  // inflate her own view counts. User-scoped client reads the active
  // auth session from cookies (which coexist with wld_visitor).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.id === profile.user_id) {
    return silentOk(sessionId, sessionWasCreated)
  }

  const { error: insertErr } = await admin.from('model_analytics_events').insert({
    model_id: profile.id,
    event_type,
    target_id: typeof target_id === 'string' ? target_id : null,
    ip_hash: hashIp(ip),
    session_id: sessionId,
    user_agent: userAgent ?? null,
    device_type: detectDevice(userAgent),
    referrer: typeof referrer === 'string' ? referrer : null,
    utm_params: typeof utm_params === 'object' && utm_params !== null ? utm_params : null,
  })
  if (insertErr) {
    // Silent to client; log for ops. Most likely cause of insert
    // failure: target_id is a malformed UUID from a client bug, which
    // the column's uuid type rejects. Not worth surfacing — fix ships
    // via client update, not endpoint behavior change.
    console.error('[analytics/track] insert failed:', insertErr.message)
  }

  return silentOk(sessionId, sessionWasCreated)
}
