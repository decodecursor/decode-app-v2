import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { ibanLast4, isValidIban, normalizeIban } from '@/lib/ambassador/iban'

/**
 * Ambassador-side bank account endpoint per settings_final_UI_Spec.md §5.5.
 *
 * GET   → returns { bank_name, beneficiary_name, iban_last4, swift_code,
 *                   status } for the caller's primary bank, or null if none.
 *         NEVER returns the full iban_number — security boundary at the
 *         API layer per Q1=D compensating controls.
 *
 * POST  → creates a new primary bank for the caller. Requires bank_name +
 *         beneficiary_name + iban_number. Returns 409 if a primary already
 *         exists (client should PATCH instead — modal "add" vs "edit" modes).
 *
 * PATCH → updates the caller's existing primary bank. All fields optional;
 *         only included fields are updated. If iban_number is provided,
 *         re-extracts iban_last4 + resets status='pending' (verification
 *         must redo). If iban_number is absent (edit-mode blank-field UX
 *         per spec §4.6), leaves the existing IBAN + last4 untouched.
 *
 * Auth shape: auth.getUser() with cookies (anon client) for identity, then
 * service-role client for writes. Service-role bypasses RLS but app code
 * scopes to user_id explicitly. Defense-in-depth: RLS owner-only policies
 * remain in place for any non-service-role caller (e.g. the legacy
 * /api/user/bank-account endpoint).
 *
 * V1 IBAN handling per locked Q1=D: plaintext at rest. Encryption +
 * legacy endpoint retrofit deferred to hardening item 39 (combined
 * post-V1 security slice). Spec §4.9 "encrypted at rest" SUPERSEDED for
 * V1 — documented in 8 closeout.
 */

interface BankBody {
  bank_name?: string
  beneficiary_name?: string
  iban_number?: string
  swift_code?: string | null
}

interface BankRow {
  id: string
  bank_name: string
  beneficiary_name: string
  iban_last4: string
  swift_code: string | null
  status: string
}

const BANK_RETURN_COLUMNS = 'id, bank_name, beneficiary_name, iban_last4, swift_code, status'

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('user_bank_accounts')
    .select(BANK_RETURN_COLUMNS)
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle<BankRow>()

  if (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  // null is the State A signal to the client (no bank set up yet).
  return NextResponse.json({ data: data ?? null })
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: BankBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const bank_name = body.bank_name?.trim() ?? ''
  const beneficiary_name = body.beneficiary_name?.trim() ?? ''
  const ibanRaw = body.iban_number?.trim() ?? ''
  const swift_code = body.swift_code?.trim() || null

  if (!bank_name || !beneficiary_name || !ibanRaw) {
    return NextResponse.json(
      { error: 'bank_name, beneficiary_name, and iban_number are required' },
      { status: 400 },
    )
  }

  const ibanNormalized = normalizeIban(ibanRaw)
  if (!isValidIban(ibanNormalized)) {
    return NextResponse.json({ error: 'Invalid IBAN format' }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  // Spec §5.5 has no explicit conflict behavior; we 409 when a primary
  // already exists rather than destructively replacing (the legacy
  // /api/user/bank-account does delete-then-insert, which loses history
  // — not what we want for V1 audit posture). Modal client knows
  // whether to call POST (add mode) or PATCH (edit mode).
  const { data: existing } = await admin
    .from('user_bank_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Primary bank account already exists — use PATCH to update' },
      { status: 409 },
    )
  }

  const { data, error } = await admin
    .from('user_bank_accounts')
    .insert({
      user_id: userId,
      bank_name,
      beneficiary_name,
      iban_number: ibanNormalized,
      iban_last4: ibanLast4(ibanNormalized),
      swift_code,
      is_primary: true,
      is_verified: false,
      status: 'pending',
    })
    .select(BANK_RETURN_COLUMNS)
    .single<BankRow>()

  if (error) {
    return NextResponse.json({ error: 'Insert failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: BankBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build patch object explicitly — never include iban_number unless the
  // caller provided it (spec §4.6 edit-mode UX: blank IBAN field = keep
  // existing). Same posture for last4 + status — they only change when
  // iban changes.
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body.bank_name === 'string') {
    const trimmed = body.bank_name.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'bank_name cannot be empty' }, { status: 400 })
    }
    patch.bank_name = trimmed
  }

  if (typeof body.beneficiary_name === 'string') {
    const trimmed = body.beneficiary_name.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'beneficiary_name cannot be empty' }, { status: 400 })
    }
    patch.beneficiary_name = trimmed
  }

  if (typeof body.iban_number === 'string' && body.iban_number.trim().length > 0) {
    const ibanNormalized = normalizeIban(body.iban_number)
    if (!isValidIban(ibanNormalized)) {
      return NextResponse.json({ error: 'Invalid IBAN format' }, { status: 400 })
    }
    patch.iban_number = ibanNormalized
    patch.iban_last4 = ibanLast4(ibanNormalized)
    // Re-verification needed when IBAN changes — admin will re-flip to
    // 'verified' on next payout batch attempt (V1 manual SQL flow).
    patch.status = 'pending'
    patch.is_verified = false
  }

  // SWIFT/BIC is optional; allow explicit null to clear it.
  if (body.swift_code === null) {
    patch.swift_code = null
  } else if (typeof body.swift_code === 'string') {
    const trimmed = body.swift_code.trim()
    patch.swift_code = trimmed || null
  }

  // Only updated_at + the patched fields. If client sent an empty body,
  // we still bump updated_at — harmless idempotent touch.
  const admin = createServiceRoleClient()

  const { data, error } = await admin
    .from('user_bank_accounts')
    .update(patch)
    .eq('user_id', userId)
    .eq('is_primary', true)
    .select(BANK_RETURN_COLUMNS)
    .maybeSingle<BankRow>()

  if (error) {
    return NextResponse.json({ error: 'Update failed', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json(
      { error: 'No primary bank account to update — POST first' },
      { status: 404 },
    )
  }

  return NextResponse.json({ data })
}
