'use client'

/**
 * Change-URL (slug) modal — 2-step bottom-sheet.
 *
 * Step 1: input + debounced uniqueness check (mirrors onboarding
 * setup/page.tsx slug pipeline verbatim — Principle E reuse of the
 * 450ms debounce + SlugStatus state + check-slug GET endpoint).
 * Step 2: old → new diff + warning + Confirm.
 *
 * Validation order (client + mirrored server-side in the PATCH route
 * for defense-in-depth): format regex → reserved list → uniqueness.
 *
 * Self-slug guard is client-only — the public check-slug endpoint
 * doesn't know who's asking, so a user pasting their own current
 * slug would get back "taken" (their own row). The modal short-
 * circuits before fetching: input === currentSlug → status='current',
 * "Review change" stays disabled, neutral message shown.
 *
 * Chrome family: bottom-sheet with 420px maxWidth, drag handle, 18/700
 * title, 13/#888 subtitle (matches the rest of components/ambassador/*
 * post-Slice-8.5 width sweep). Backdrop-tap close (BankModal pattern),
 * disabled while saving so an accidental backdrop tap mid-PATCH can't
 * abort.
 *
 * Success path: PATCH /api/ambassador/model/settings { slug }, parent
 * receives the updated profile via onSlugChanged, fires its own toast
 * + setProfile, modal closes. Error: stay on step 2 with inline error
 * (covers race condition where slug was free at step 1 but taken by
 * the time the user confirmed).
 */

import { useEffect, useRef, useState } from 'react'

type Step = 1 | 2
type SlugStatus = 'idle' | 'current' | 'short' | 'checking' | 'available' | 'taken'

const SLUG_FORMAT_RE = /^[a-z0-9_]{3,30}$/

interface Profile {
  slug: string
}

export function ChangeUrlModal({
  open,
  onClose,
  currentSlug,
  appHost,
  onSlugChanged,
  onError,
}: {
  open: boolean
  onClose: () => void
  currentSlug: string
  appHost: string
  onSlugChanged: (profile: Profile) => void
  onError: (msg: string) => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [value, setValue] = useState('')
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugError, setSlugError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setValue('')
    setSlugStatus('idle')
    setSlugError('')
    setSaving(false)
    setConfirmError('')
  }, [open])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const checkSlug = (raw: string) => {
    const v = raw.toLowerCase().trim()
    setSlugError('')
    setConfirmError('')

    if (!v) {
      setSlugStatus('idle')
      return
    }
    if (v === currentSlug) {
      setSlugStatus('current')
      return
    }
    if (v.length < 3) {
      setSlugStatus('short')
      setSlugError('Min 3 characters')
      return
    }
    if (!SLUG_FORMAT_RE.test(v)) {
      setSlugStatus('taken')
      setSlugError('Use 3-30 lowercase letters, numbers, or underscores')
      return
    }

    setSlugStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const query = v
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ambassador/model/check-slug?slug=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.available) {
          setSlugStatus('available')
          setSlugError('')
        } else {
          setSlugStatus('taken')
          setSlugError(data.error || 'Not available')
        }
      } catch {
        setSlugStatus('idle')
      }
    }, 450)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
    setValue(next)
    checkSlug(next)
  }

  const reviewEnabled = slugStatus === 'available' && value.length > 0 && value !== currentSlug

  const onReview = () => {
    if (!reviewEnabled) return
    setStep(2)
  }

  const onConfirm = async () => {
    if (saving) return
    setSaving(true)
    setConfirmError('')
    try {
      const res = await fetch('/api/ambassador/model/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: value }),
      })
      const data = await res.json()
      if (res.ok && data.profile) {
        onSlugChanged(data.profile as Profile)
        return
      }
      // Race: slug was available at step 1, taken by the time user confirmed.
      // Server returned 409 (taken), 400 (format/reserved invalid — shouldn't
      // hit since client validated, but defense-in-depth surfaces the error).
      setSaving(false)
      const msg = data.error || 'Could not change URL. Try again.'
      if (res.status === 409) {
        // Reset to step 1 so user can pick a different slug.
        setStep(1)
        setSlugStatus('taken')
        setSlugError(msg)
      } else {
        setConfirmError(msg)
      }
    } catch {
      setSaving(false)
      onError('Network error')
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        style={{
          background: '#1c1c1c',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 420,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />

        {step === 1 ? (
          <Step1
            value={value}
            currentSlug={currentSlug}
            appHost={appHost}
            slugStatus={slugStatus}
            slugError={slugError}
            reviewEnabled={reviewEnabled}
            onChange={onInputChange}
            onReview={onReview}
            onCancel={onClose}
          />
        ) : (
          <Step2
            currentSlug={currentSlug}
            newSlug={value}
            appHost={appHost}
            saving={saving}
            confirmError={confirmError}
            onConfirm={onConfirm}
            onBack={() => { if (!saving) setStep(1) }}
          />
        )}
      </div>
    </div>
  )
}

function Step1({
  value,
  currentSlug,
  appHost,
  slugStatus,
  slugError,
  reviewEnabled,
  onChange,
  onReview,
  onCancel,
}: {
  value: string
  currentSlug: string
  appHost: string
  slugStatus: SlugStatus
  slugError: string
  reviewEnabled: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onReview: () => void
  onCancel: () => void
}) {
  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
        Change your URL
      </div>
      <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 8, lineHeight: 1.5 }}>
        Pick a new URL for your page.
      </div>
      <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 20 }}>
        Current: {appHost}/{currentSlug}
      </div>

      <div
        style={{
          background: '#111',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 6,
          border: `1px solid ${slugStatus === 'taken' || slugStatus === 'short' ? '#ef4444' : '#333'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          transition: 'border-color 0.2s',
        }}
      >
        <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {appHost}/
        </span>
        <input
          type="text"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={onChange}
          placeholder="yourname"
          maxLength={30}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            fontWeight: 500,
            color: '#fff',
            caretColor: '#e91e8c',
            fontFamily: 'inherit',
            paddingLeft: 0,
          }}
        />
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', width: 16, justifyContent: 'center' }}>
          {slugStatus === 'checking' && (
            <span
              style={{
                width: 12,
                height: 12,
                border: '1.5px solid #333',
                borderTopColor: '#888',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'cu-spin 0.7s linear infinite',
              }}
            />
          )}
          {slugStatus === 'available' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {slugStatus === 'taken' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </span>
      </div>

      {slugStatus === 'current' && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 12, paddingLeft: 4 }}>
          This is already your current URL.
        </div>
      )}
      {(slugStatus === 'taken' || slugStatus === 'short') && slugError && (
        <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12, paddingLeft: 4 }}>
          {slugError}
        </div>
      )}
      {slugStatus !== 'current' && slugStatus !== 'taken' && slugStatus !== 'short' && (
        <div style={{ height: 11, marginBottom: 12 }} />
      )}

      <button
        type="button"
        onClick={onReview}
        disabled={!reviewEnabled}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: 12,
          background: reviewEnabled ? '#e91e8c' : '#2a2a2a',
          color: reviewEnabled ? '#fff' : '#666',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: reviewEnabled ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          marginBottom: 10,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        Review change
      </button>

      <div
        onClick={onCancel}
        style={{
          textAlign: 'center',
          fontSize: 14,
          color: '#888',
          cursor: 'pointer',
          padding: 8,
        }}
      >
        Cancel
      </div>

      <style>{`@keyframes cu-spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}

function Step2({
  currentSlug,
  newSlug,
  appHost,
  saving,
  confirmError,
  onConfirm,
  onBack,
}: {
  currentSlug: string
  newSlug: string
  appHost: string
  saving: boolean
  confirmError: string
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
        Confirm URL change
      </div>
      <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
        Double-check the new URL before confirming.
      </div>

      <div
        style={{
          background: '#111',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 10,
          border: '1px solid #262626',
        }}
      >
        <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          Old
        </div>
        <div style={{ fontSize: 13, color: '#888', textDecoration: 'line-through' }}>
          {appHost}/{currentSlug}
        </div>
      </div>

      <div
        style={{
          background: '#111',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 14,
          border: '1px solid #e91e8c',
        }}
      >
        <div style={{ fontSize: 9, color: '#e91e8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          New
        </div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
          {appHost}/{newSlug}
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#e91e8c', lineHeight: 1.5, marginBottom: 18, paddingLeft: 4, paddingRight: 4 }}>
        Anyone with your old link will need the new one. Update your social bios and any shared links after changing.
      </div>

      {confirmError && (
        <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12, paddingLeft: 4 }}>
          {confirmError}
        </div>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={saving}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: 12,
          background: '#e91e8c',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: saving ? 'default' : 'pointer',
          fontFamily: 'inherit',
          marginBottom: 10,
          opacity: saving ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? 'Changing…' : 'Confirm change'}
      </button>

      <div
        onClick={onBack}
        style={{
          textAlign: 'center',
          fontSize: 14,
          color: saving ? '#444' : '#888',
          cursor: saving ? 'default' : 'pointer',
          padding: 8,
        }}
      >
        Back
      </div>
    </>
  )
}
