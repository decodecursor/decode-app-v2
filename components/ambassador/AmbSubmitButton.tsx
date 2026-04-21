'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

export type AmbSubmitVerb = 'send' | 'verify' | 'save' | 'delete'
export type AmbSubmitVariant = 'solid' | 'outline'

type Phase = 'idle' | 'inflight' | 'success'

const VERB_LABELS: Record<AmbSubmitVerb, { inflight: string; success: string | null }> = {
  send:   { inflight: 'Sending',   success: 'Sent!' },
  verify: { inflight: 'Verifying', success: 'Verified!' },
  save:   { inflight: 'Saving',    success: 'Saved!' },
  delete: { inflight: 'Deleting',  success: null },
}

const SUCCESS_HOLD_MS = 400

interface Props {
  verb: AmbSubmitVerb
  idleLabel: string
  onSubmit: () => Promise<void>
  onDone?: () => void
  disabled?: boolean
  variant?: AmbSubmitVariant
  style?: CSSProperties
  // When this number changes, the button auto-fires onSubmit (used by
  // verify page to fire on OTP-complete). Pair with `disabled` gating.
  triggerKey?: number
}

export function AmbSubmitButton({
  verb,
  idleLabel,
  onSubmit,
  onDone,
  disabled = false,
  variant = 'solid',
  style,
  triggerKey,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase

  const isBusy = phase !== 'idle'
  const clickable = !disabled && phase === 'idle'

  const fire = useCallback(async () => {
    if (phaseRef.current !== 'idle') return
    setPhase('inflight')
    try {
      await onSubmit()
      const labels = VERB_LABELS[verb]
      if (labels.success) {
        setPhase('success')
        setTimeout(() => {
          if (onDone) onDone()
          setPhase('idle')
        }, SUCCESS_HOLD_MS)
      } else {
        if (onDone) onDone()
        setPhase('idle')
      }
    } catch {
      setPhase('idle')
    }
  }, [onSubmit, onDone, verb])

  const handleClick = useCallback(() => {
    if (!clickable) return
    void fire()
  }, [clickable, fire])

  const lastTriggerRef = useRef<number | undefined>(triggerKey)
  useEffect(() => {
    if (triggerKey === undefined) return
    if (lastTriggerRef.current === triggerKey) return
    lastTriggerRef.current = triggerKey
    if (disabled) return
    void fire()
  }, [triggerKey, disabled, fire])

  const labels = VERB_LABELS[verb]
  const successLabel = labels.success ?? labels.inflight

  const baseStyle: CSSProperties =
    variant === 'solid'
      ? {
          background: disabled && phase === 'idle' ? '#333' : '#e91e8c',
          color: disabled && phase === 'idle' ? '#666' : '#fff',
          borderRadius: 12,
          padding: 14,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          cursor: clickable ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          userSelect: 'none',
          pointerEvents: isBusy ? 'none' : 'auto',
        }
      : {
          background: disabled && phase === 'idle' ? 'transparent' : '#e91e8c',
          color: disabled && phase === 'idle' ? '#555' : '#fff',
          border: `1.5px solid ${disabled && phase === 'idle' ? '#2a2a2a' : '#e91e8c'}`,
          borderRadius: 12,
          padding: 16,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 600,
          cursor: clickable ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s',
          userSelect: 'none',
          pointerEvents: isBusy ? 'none' : 'auto',
        }

  if (phase === 'success') {
    baseStyle.animation = `amb-submit-flash ${SUCCESS_HOLD_MS}ms ease-out`
  }

  return (
    <div
      role="button"
      aria-busy={isBusy}
      aria-disabled={!clickable}
      onClick={handleClick}
      style={{ ...baseStyle, ...style }}
    >
      {phase === 'idle' && idleLabel}
      {phase === 'inflight' && (
        <>
          {labels.inflight}
          <span className="amb-dot amb-dot-1">.</span>
          <span className="amb-dot amb-dot-2">.</span>
          <span className="amb-dot amb-dot-3">.</span>
        </>
      )}
      {phase === 'success' && successLabel}
    </div>
  )
}
