import { randomUUID, createHmac } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Session + IP-hash helpers for the public analytics pipeline.
 *
 * Cookie contract (wld_visitor):
 *  - Set once on first tracked event per browser
 *  - 30-day max-age so the same visitor reuses the same session ID
 *    across days (dedup / return-visitor identification)
 *  - HTTPOnly — only the server reads it. Client never touches it.
 *  - SameSite=lax so navigation from external surfaces (IG links,
 *    WhatsApp, email) delivers the cookie.
 *
 * IP hash contract:
 *  - HMAC-SHA256(ip || '|' || YYYY-MM-DD || salt), hex-truncated to 16
 *  - Daily date rotation keeps the hash bucket stable within a day
 *    (so bucketing/aggregation works for that day) but makes cross-day
 *    re-identification infeasible without the salt. Raw IP is never
 *    stored — GDPR-safe per spec §2.4 industry-standard approach.
 */

const COOKIE_NAME = 'wld_visitor'
const COOKIE_MAX_AGE_SEC = 86_400 * 30 // 30 days

export function readSessionId(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null
}

export function createSessionId(): string {
  return randomUUID()
}

export function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: sessionId,
    maxAge: COOKIE_MAX_AGE_SEC,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export function hashIp(ip: string): string {
  const salt = process.env.ANALYTICS_IP_SALT ?? 'dev-salt-not-for-prod'
  const day = new Date().toISOString().slice(0, 10) // UTC YYYY-MM-DD
  return createHmac('sha256', salt)
    .update(`${ip}|${day}`)
    .digest('hex')
    .slice(0, 16)
}

export function detectDevice(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop'
  // Tablet check first — iPads + Android-without-Mobile-token are tablets.
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent)) return 'tablet'
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(userAgent)) return 'mobile'
  return 'desktop'
}
