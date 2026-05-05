// ============================================================================
// hCaptcha — server-side verification
// Requires env: HCAPTCHA_SECRET_KEY
//
// Replaces the prior Cloudflare Turnstile helper (lib/ambassador/turnstile.ts,
// removed in this commit). Globally fail-closed per locked decision 2A:
// empty token / missing secret / network error / siteverify reject all
// return false. The previous Turnstile helper was fail-open on empty token —
// that asymmetry is gone.
//
// Dev affordance preserved: missing HCAPTCHA_SECRET_KEY in development
// returns true so local dev without env vars still functions; production
// returns false (fail-closed).
// ============================================================================

interface HcaptchaVerifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

/**
 * Verify an hCaptcha token server-side.
 * Returns true only if the token is valid and Cloudflare-style siteverify reports success.
 *
 * Usage in API routes:
 *   const isHuman = await verifyHcaptcha(req.body.hcaptchaToken)
 *   if (!isHuman) return Response.json({ error: 'Verification failed.' }, { status: 403 })
 */
export async function verifyHcaptcha(token: string): Promise<boolean> {
  if (!token) return false

  const secret = process.env.HCAPTCHA_SECRET_KEY
  if (!secret) {
    console.error('[hCaptcha] HCAPTCHA_SECRET_KEY not configured')
    return process.env.NODE_ENV === 'development'
  }

  try {
    const body = new URLSearchParams({ secret, response: token })
    const res = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data: HcaptchaVerifyResponse = await res.json()

    if (!data.success) {
      console.warn('[hCaptcha] Verification failed:', data['error-codes'])
    }

    return data.success
  } catch (err) {
    console.error('[hCaptcha] Verification error:', err)
    return false
  }
}
