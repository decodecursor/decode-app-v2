'use client'

/**
 * Cloudflare Turnstile widget hook (Slice 5B-1, hardening item 22).
 *
 * Consolidates the script-load + widget-render + token-callback pattern
 * across auth-page consumers. Single declaration site for the
 * Window.turnstile interface; each consumer used to inline the same
 * pattern + duplicate the type.
 *
 * Usage (current consumers — both auth pages):
 *   const { token, reset, containerRef } = useTurnstile({
 *     size: 'compact', refreshExpired: 'auto'
 *   })
 *   return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }} />
 *
 * Cloudflare's valid sizes are 'compact' | 'flexible' | 'normal'. The
 * legacy 'invisible' value was deprecated. The widget renders visibly
 * (compact = 150×140 with checkbox + Cloudflare wordmark) just above
 * the auth page's submit button — see HANDOFF item 43 for the rationale
 * (Turnstile dropped from /api/checkout/* in favor of rate-limit +
 * Stripe Radar; auth pages keep visible Turnstile because credential
 * stuffing + SMS-pump-fraud are real targets and the captcha-on-login
 * UX is industry standard). Earlier interaction-only + display:none
 * pattern deadlocked when Cloudflare's risk model wanted interaction.
 * On expired/error callbacks the token is cleared automatically; on
 * a network failure the consumer should call `reset()` to force a
 * fresh token before retrying.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string
      reset: (widgetId: string) => void
    }
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

export interface UseTurnstileOptions {
  size?: 'compact' | 'flexible' | 'normal'
  appearance?: 'interaction-only' | 'always' | 'execute'
  refreshExpired?: 'auto' | 'manual' | 'never'
}

export interface UseTurnstileResult {
  token: string
  reset: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useTurnstile(options: UseTurnstileOptions = {}): UseTurnstileResult {
  const [token, setToken] = useState('')
  const widgetId = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Capture options once on mount — neither consumer changes these
  // post-mount, and re-rendering the widget on prop change would also
  // need a teardown path that adds complexity for no real use case.
  const optsRef = useRef(options)

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (!siteKey) {
      console.warn('[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured; skipping widget')
      return
    }

    const mount = () => {
      if (!window.turnstile) return
      if (widgetId.current) return
      const el = containerRef.current
      if (!el) return
      const opts = optsRef.current
      const renderOpts: Record<string, unknown> = {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      }
      if (opts.size) renderOpts.size = opts.size
      if (opts.appearance) renderOpts.appearance = opts.appearance
      if (opts.refreshExpired) renderOpts['refresh-expired'] = opts.refreshExpired
      widgetId.current = window.turnstile.render(el, renderOpts)
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)
    if (existing) {
      if (window.turnstile) {
        mount()
      } else {
        existing.addEventListener('load', mount, { once: true })
      }
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = mount
    document.head.appendChild(script)
    // Script intentionally NOT removed on unmount — keep it loaded so
    // SPA navigations back to a Turnstile page don't re-download. Pre-
    // refactor the auth page removed it on unmount; that was unnecessary
    // cleanup (one wasted re-download per back-nav) and is dropped here.
  }, [])

  const reset = useCallback(() => {
    setToken('')
    if (window.turnstile && widgetId.current) {
      window.turnstile.reset(widgetId.current)
    }
  }, [])

  return { token, reset, containerRef }
}
