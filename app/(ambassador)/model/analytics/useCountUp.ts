'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Number count-up hook. Mirrors the mockup's `animateNumber()`
 * (analytics_final.html lines 783-797) — ease-out cubic, 1000ms on
 * mount, 700ms when the source value swaps. Renders a formatted
 * string with the same prefix (e.g. `$`) and en-US thousand
 * separators as the target string.
 *
 * Usage: pass a target like `$1,384`. The hook strips the prefix
 * + commas to interpolate the numeric portion, then re-applies the
 * prefix on each frame.
 */
export function useCountUp(target: string, opts?: { mountMs?: number; swapMs?: number }): string {
  const mountMs = opts?.mountMs ?? 1000
  const swapMs  = opts?.swapMs  ?? 700
  const [display, setDisplay] = useState(target)
  const prevTarget = useRef<string>('')
  const isMounted  = useRef(false)

  useEffect(() => {
    const fromStr = isMounted.current ? prevTarget.current : zeroLike(target)
    const dur = isMounted.current ? swapMs : mountMs
    isMounted.current = true
    prevTarget.current = target

    const fromNum = parseNumeric(fromStr)
    const toNum   = parseNumeric(target)
    const prefix  = target.match(/^[^0-9-]*/)?.[0] ?? ''
    const suffix  = target.match(/[^0-9.,]*$/)?.[0] ?? ''

    if (!Number.isFinite(fromNum) || !Number.isFinite(toNum) || dur === 0 || fromNum === toNum) {
      setDisplay(target)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const val = Math.round(fromNum + (toNum - fromNum) * eased)
      setDisplay(prefix + val.toLocaleString('en-US') + suffix)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, mountMs, swapMs])

  return display
}

function parseNumeric(str: string): number {
  const cleaned = str.replace(/[^0-9.-]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function zeroLike(target: string): string {
  const prefix = target.match(/^[^0-9-]*/)?.[0] ?? ''
  return `${prefix}0`
}
