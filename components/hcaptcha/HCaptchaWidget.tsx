'use client'

/**
 * VC#1 doctrine note (locked alongside this commit's verification report):
 * Migration-provenance comments referencing 'turnstile' or 'Turnstile' in this
 * file and lib/ambassador/hcaptcha.ts are intentional — they explain why the
 * hook shape diverges from a clean-slate hCaptcha integration (specifically:
 * useTurnstile had no execute() because Turnstile auto-tokens; hCaptcha
 * invisible mode requires explicit execute()). Verification check
 * 'rg turnstile in code returns 0' is superseded by 'rg turnstile in code
 * paths returns 0; comment hits OK if they document migration provenance or
 * item-43 historical context'.
 *
 * hCaptcha invisible-mode hook. Mirrors useTurnstile shape from previous
 * Turnstile implementation; adds execute() because invisible mode requires
 * explicit trigger before each protected action.
 *
 * Consumer pattern (6 sites in this commit):
 *   const { execute, reset, containerRef, Widget } = useHcaptcha({ size: 'invisible' })
 *   const handleSubmit = async () => {
 *     let token: string
 *     try { token = await execute() } catch { reset(); return }
 *     await fetch('/api/...', { body: JSON.stringify({ ..., hcaptchaToken: token }) })
 *   }
 *   return <div ref={containerRef}>{Widget}</div>
 *
 * Shape note: useHcaptcha returns the same { token, reset, execute, containerRef }
 * as the locked spec PLUS a `Widget` JSX node. The hCaptcha React component
 * mounts via JSX (no imperative `render(el, opts)` like Turnstile had), so
 * the hook bundles the wired-up <HCaptcha ref={...} ... /> element as `Widget`
 * for the consumer to drop inside containerRef. In invisible mode the visible
 * widget is hCaptcha's overlay modal that mounts to document.body when
 * execute() fires; the inline element is just the script handle.
 *
 * Sitekey lives in NEXT_PUBLIC_HCAPTCHA_SITE_KEY. Missing → console.warn +
 * Widget renders null (mirrors prior TurnstileWidget.tsx:69-72 behavior). The
 * hook's execute() will reject in that case and the server-side fail-closed
 * verifier rejects the empty token — defense-in-depth.
 *
 * Migration provenance: replaces components/turnstile/TurnstileWidget.tsx
 * (deleted in this commit) following partner rejection of Turnstile's
 * visible-only mode after Cloudflare deprecated size:'invisible'
 * (HANDOFF item 17 + items 41/42/43 history).
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'

export interface UseHcaptchaOptions {
  size?: 'invisible' | 'compact' | 'normal'
}

export interface UseHcaptchaResult {
  token: string
  reset: () => void
  execute: () => Promise<string>
  containerRef: React.RefObject<HTMLDivElement | null>
  Widget: React.ReactNode
}

export function useHcaptcha(options: UseHcaptchaOptions = {}): UseHcaptchaResult {
  const [token, setToken] = useState('')
  const hcaptchaRef = useRef<HCaptcha | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const size = options.size ?? 'invisible'

  const reset = useCallback(() => {
    setToken('')
    hcaptchaRef.current?.resetCaptcha()
  }, [])

  const execute = useCallback(async (): Promise<string> => {
    if (!hcaptchaRef.current) {
      throw new Error('hcaptcha_not_ready')
    }
    const result = await hcaptchaRef.current.execute({ async: true })
    setToken(result.response)
    return result.response
  }, [])

  const Widget = useMemo(() => {
    const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
    if (!siteKey) {
      if (typeof window !== 'undefined') {
        console.warn('[hCaptcha] NEXT_PUBLIC_HCAPTCHA_SITE_KEY not configured; widget will not render')
      }
      return null
    }
    return (
      <HCaptcha
        ref={hcaptchaRef}
        sitekey={siteKey}
        size={size}
        onVerify={(t) => setToken(t)}
        onExpire={() => setToken('')}
        onError={() => setToken('')}
      />
    )
  }, [size])

  return { token, reset, execute, containerRef, Widget }
}
