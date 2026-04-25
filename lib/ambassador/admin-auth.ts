import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Admin-auth helper for /api/admin/* endpoints. Mirrors the sound
 * pattern from app/api/analytics/model/route.ts:9-26: auth.getUser
 * → 401 if missing → SELECT role from public.users → 403 if not Admin.
 *
 * Per Slice 6 locked decision #2 + hardening item 29: do NOT inherit
 * the `?adminUserId` query-param gate from /api/admin/transfers/route.ts
 * — that pattern trusts a client-supplied identifier with no
 * auth.getUser cross-check (client-spoofable). Real-money admin
 * endpoints must use the auth.getUser pattern.
 *
 * Returns { user, supabase } on success, or a NextResponse with the
 * appropriate error status. Caller pattern:
 *
 *   const gate = await requireAdmin(req)
 *   if (gate instanceof NextResponse) return gate
 *   const { user } = gate
 */
export async function requireAdmin(_req: NextRequest | Request): Promise<
  | { user: { id: string } }
  | NextResponse
> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error: roleErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (roleErr) {
    return NextResponse.json({ error: 'Role lookup failed' }, { status: 500 })
  }
  if (!row || row.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user: { id: user.id } }
}
