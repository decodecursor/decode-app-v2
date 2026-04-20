'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

const EMPTY: string[] = ['', '', '', '', '', '']

export type OtpInputHandle = {
  focusFirst: () => void
}

export const OtpInput = forwardRef<
  OtpInputHandle,
  {
    value: string[]
    onChange: (next: string[]) => void
    onComplete?: (code: string) => void
    error?: boolean
    shake?: boolean
    autoFocus?: boolean
  }
>(function OtpInput(
  { value, onChange, onComplete, error, shake, autoFocus = true },
  ref,
) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useImperativeHandle(
    ref,
    () => ({
      focusFirst: () => inputRefs.current[0]?.focus(),
    }),
    [],
  )

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [autoFocus])

  const handleInput = useCallback(
    (index: number, raw: string) => {
      const digit = raw.replace(/\D/g, '').slice(-1)
      const next = [...value]
      next[index] = digit
      onChange(next)
      if (digit && index < 5) inputRefs.current[index + 1]?.focus()
      if (digit && index === 5 && next.every((d) => d.length === 1)) {
        onComplete?.(next.join(''))
      }
    },
    [value, onChange, onComplete],
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const next = [...value]
        next[index - 1] = ''
        onChange(next)
      }
    },
    [value, onChange],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      if (!text) return
      const digits = text.split('')
      const next = [...EMPTY]
      digits.forEach((d, i) => {
        if (i < 6) next[i] = d
      })
      onChange(next)
      const focusIdx = Math.min(digits.length, 5)
      inputRefs.current[focusIdx]?.focus()
      if (digits.length === 6) onComplete?.(next.join(''))
    },
    [onChange, onComplete],
  )

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        marginBottom: 24,
        animation: shake
          ? 'ambassador-shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97)'
          : undefined,
      }}
      onPaste={handlePaste}
    >
      {value.map((digit, i) => {
        const isError = !!error && !!shake
        const borderColor = isError
          ? '#ef4444'
          : digit
          ? '#e91e8c'
          : '#262626'
        return (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => {
              if (!isError) e.target.style.borderColor = '#e91e8c'
            }}
            onBlur={(e) => {
              if (!isError && !digit) e.target.style.borderColor = '#262626'
            }}
            style={{
              width: 42,
              height: 54,
              background: 'transparent',
              border: `1.5px solid ${borderColor}`,
              borderRadius: 10,
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              caretColor: '#e91e8c',
              transition: 'border-color 0.15s',
              outline: 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          />
        )
      })}
    </div>
  )
})
