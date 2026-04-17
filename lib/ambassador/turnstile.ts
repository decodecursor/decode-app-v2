// ============================================================================
// Cloudflare Turnstile — server-side verification
// Requires env: TURNSTILE_SECRET_KEY
// ============================================================================

interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if the token is valid (human visitor).
 *
 * Usage in API routes:
 *   const isHuman = await verifyTurnstile(req.body.turnstileToken)
 *   if (!isHuman) return Response.json({ error: 'Bot detected' }, { status: 403 })
 */
export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) {
    console.warn('[Turnstile] Empty token — skipping verification (widget may not have loaded)')
    return true
  }

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error('[Turnstile] TURNSTILE_SECRET_KEY not configured')
    // Fail open in development, fail closed in production
    return process.env.NODE_ENV === 'development'
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    })

    const data: TurnstileVerifyResponse = await res.json()

    if (!data.success) {
      console.warn('[Turnstile] Verification failed:', data['error-codes'])
    }

    return data.success
  } catch (err) {
    console.error('[Turnstile] Verification error:', err)
    return false
  }
}
