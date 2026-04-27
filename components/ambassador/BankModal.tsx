'use client'

/**
 * Bank account modal — single-step add OR edit per
 * settings_final_UI_Spec.md §4.4-§4.8.
 *
 * Chrome matches existing AddEmailModal / ChangeEmailModal pattern
 * (same overlay, sheet shape, drag handle, padding, field box, error
 * style). Mode-driven copy + validation:
 *
 * Add mode:
 *   - title: "Add bank account"
 *   - all 4 fields blank
 *   - IBAN required + valid → enables save
 *   - server: POST /api/ambassador/bank-account
 *
 * Edit mode:
 *   - title: "Update bank account"
 *   - bank/beneficiary/swift pre-filled from `initial`
 *   - IBAN field BLANK with placeholder "Re-enter IBAN to change"
 *     (per spec §4.6 — full IBAN never returned by server)
 *   - bank+beneficiary required; IBAN optional but valid-if-typed
 *   - server: PATCH /api/ambassador/bank-account
 *
 * Spec §4.7 IBAN validation regex (basic ISO 13616 shape):
 *   /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/
 * Server does per-country exact-length validation; client is the
 * convenience filter.
 *
 * On success: onSaved(BankAccount) → caller closes modal + triggers
 * row-saved-flash on the card + toasts "Bank saved ✓".
 *
 * On 4xx/5xx error: stays open, surfaces error below the relevant
 * field (or as a toast for non-field errors).
 */

import { useEffect, useState } from 'react'
import { isValidIban, normalizeIban } from '@/lib/ambassador/iban'

export interface BankAccountSummary {
  id: string
  bank_name: string
  beneficiary_name: string
  iban_last4: string
  swift_code: string | null
  status: string
}

interface BankModalProps {
  open: boolean
  mode: 'add' | 'edit'
  /** Pre-fill source for edit mode (iban_last4 used for placeholder hint). */
  initial?: BankAccountSummary | null
  onClose: () => void
  onSaved: (saved: BankAccountSummary) => void
}

export function BankModal({ open, mode, initial, onClose, onSaved }: BankModalProps) {
  const [bankName, setBankName] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [iban, setIban] = useState('')
  const [swiftCode, setSwiftCode] = useState('')
  const [ibanError, setIbanError] = useState('')
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset on open. For edit mode, pre-fill from `initial` but leave
  // IBAN blank (spec §4.6 — full IBAN never returned by server).
  useEffect(() => {
    if (!open) return
    setBankName(initial?.bank_name ?? '')
    setBeneficiaryName(initial?.beneficiary_name ?? '')
    setIban('')
    setSwiftCode(initial?.swift_code ?? '')
    setIbanError('')
    setServerError('')
    setSaving(false)
  }, [open, initial])

  if (!open) return null

  // Live IBAN validation feedback per spec §4.7. Blank = no error;
  // non-blank invalid = error below field; valid = error cleared.
  const handleIbanChange = (next: string) => {
    setIban(next)
    setServerError('')
    if (!next.trim()) {
      setIbanError('')
      return
    }
    setIbanError(isValidIban(normalizeIban(next)) ? '' : 'Invalid IBAN format')
  }

  // Save button enable rules per spec §4.5 (add) + §4.6 (edit).
  const ibanNormalizedTrim = normalizeIban(iban)
  const ibanProvided = ibanNormalizedTrim.length > 0
  const ibanValid = ibanProvided && isValidIban(ibanNormalizedTrim)
  const baseFilled = bankName.trim().length > 0 && beneficiaryName.trim().length > 0
  const canSave = mode === 'add'
    ? baseFilled && ibanValid
    : baseFilled && (!ibanProvided || ibanValid)

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setServerError('')

    const body: Record<string, string | null> = {
      bank_name: bankName.trim(),
      beneficiary_name: beneficiaryName.trim(),
    }
    // Send IBAN only when user typed one — empty string in edit mode
    // means "keep existing" per spec §4.6.
    if (ibanProvided) body.iban_number = ibanNormalizedTrim
    // Optional SWIFT — empty string clears it.
    body.swift_code = swiftCode.trim() || null

    let res: Response
    try {
      res = await fetch('/api/ambassador/bank-account', {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      setSaving(false)
      setServerError('Network error. Please try again.')
      return
    }

    let payload: { data?: BankAccountSummary; error?: string } = {}
    try {
      payload = await res.json()
    } catch {
      // Empty/invalid JSON — fall through to status-code branch.
    }

    if (!res.ok) {
      setSaving(false)
      if (res.status === 401) {
        setServerError('Please sign in again')
      } else if (res.status === 409) {
        setServerError('Bank account already exists — refresh to edit')
      } else if (res.status === 404) {
        setServerError('Bank account not found — try adding instead')
      } else if (res.status === 400 && payload.error) {
        // Field-level error from server (e.g. invalid IBAN format).
        if (payload.error.toLowerCase().includes('iban')) {
          setIbanError(payload.error)
        } else {
          setServerError(payload.error)
        }
      } else {
        setServerError(payload.error || 'Save failed. Please try again.')
      }
      return
    }

    if (!payload.data) {
      setSaving(false)
      setServerError('Save failed. Please try again.')
      return
    }

    onSaved(payload.data)
    // Caller closes the modal — keep saving=true so the button stays
    // in "Saving…" state during the unmount transition.
  }

  const titleText = mode === 'add' ? 'Add bank account' : 'Update bank account'
  const saveLabel = saving ? 'Saving…' : (mode === 'add' ? 'Add bank account' : 'Update')
  const ibanPlaceholder = mode === 'add'
    ? 'AE070331234567890123456'
    : 'Re-enter IBAN to change'

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
        // Backdrop tap closes (per spec §2.3). Inner sheet stops propagation.
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        style={{
          background: '#1c1c1c',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 500,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />

        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
          {titleText}
        </div>
        <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
          Your payouts will be sent to this account.
        </div>

        <FieldLabel>Bank name</FieldLabel>
        <FieldBox>
          <input
            type="text"
            value={bankName}
            onChange={(e) => { setBankName(e.target.value); setServerError('') }}
            placeholder="Emirates NBD"
            autoFocus={mode === 'add'}
            style={fieldInputStyle}
          />
        </FieldBox>

        <FieldLabel>Beneficiary name</FieldLabel>
        <FieldBox>
          <input
            type="text"
            value={beneficiaryName}
            onChange={(e) => { setBeneficiaryName(e.target.value); setServerError('') }}
            placeholder="Full legal name on the account"
            style={fieldInputStyle}
          />
        </FieldBox>

        <FieldLabel>IBAN</FieldLabel>
        <FieldBox error={!!ibanError}>
          <input
            type="text"
            value={iban}
            onChange={(e) => handleIbanChange(e.target.value)}
            placeholder={ibanPlaceholder}
            autoCapitalize="characters"
            spellCheck={false}
            style={{ ...fieldInputStyle, letterSpacing: '0.5px' }}
          />
        </FieldBox>
        {ibanError && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, marginBottom: 8, paddingLeft: 4 }}>
            {ibanError}
          </div>
        )}

        <FieldLabel optional>SWIFT / BIC</FieldLabel>
        <FieldBox>
          <input
            type="text"
            value={swiftCode}
            onChange={(e) => { setSwiftCode(e.target.value); setServerError('') }}
            placeholder="ABORAEADXXX"
            autoCapitalize="characters"
            spellCheck={false}
            style={{ ...fieldInputStyle, letterSpacing: '0.5px' }}
          />
        </FieldBox>

        {serverError && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 8, marginBottom: 4, paddingLeft: 4, textAlign: 'center' }}>
            {serverError}
          </div>
        )}

        <div
          onClick={handleSave}
          style={{
            marginTop: 16,
            background: canSave && !saving ? '#e91e8c' : '#333',
            color: canSave && !saving ? '#fff' : '#666',
            borderRadius: 12,
            padding: 14,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            cursor: canSave && !saving ? 'pointer' : 'not-allowed',
            userSelect: 'none',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {saveLabel}
        </div>

        <div
          onClick={() => { if (!saving) onClose() }}
          style={{
            textAlign: 'center',
            fontSize: 14,
            color: '#888',
            cursor: saving ? 'not-allowed' : 'pointer',
            padding: 8,
            marginTop: 4,
            opacity: saving ? 0.5 : 1,
          }}
        >
          Cancel
        </div>
      </div>
    </div>
  )
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 14,
  color: '#fff',
  caretColor: '#e91e8c',
  fontFamily: 'inherit',
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ fontSize: 11, color: '#888', marginBottom: 6, paddingLeft: 4 }}>
      {children}{optional ? ' (optional)' : ''}
    </div>
  )
}

function FieldBox({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div
      style={{
        background: '#111',
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 12,
        border: `1px solid ${error ? '#ef4444' : '#333'}`,
        transition: 'border-color 0.2s',
      }}
    >
      {children}
    </div>
  )
}
