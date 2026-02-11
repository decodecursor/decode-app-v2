import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret) {
    return NextResponse.json({ error: 'Missing secret' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('beauty_purchases')
    .select('id, status, amount_paid, redeemed_at, beauty_offers!inner(title, price, expires_at), beauty_businesses!inner(business_name), users!beauty_purchases_buyer_id_fkey(user_name)')
    .eq('qr_code_secret', secret)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
  }

  const offer = data.beauty_offers as unknown as { title: string; price: number; expires_at: string }
  const business = data.beauty_businesses as unknown as { business_name: string }
  const user = data.users as unknown as { user_name: string } | null

  return NextResponse.json({
    purchase_id: data.id,
    status: data.status,
    amount: data.amount_paid,
    redeemed_at: data.redeemed_at,
    buyer_name: user?.user_name || 'Customer',
    offer_title: offer.title,
    offer_expires_at: offer.expires_at,
    business_name: business.business_name,
  })
}

export async function POST(req: NextRequest) {
  let body: { secret?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { secret } = body
  if (!secret) {
    return NextResponse.json({ error: 'Missing secret' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Fetch purchase
  const { data: purchase, error: fetchError } = await supabase
    .from('beauty_purchases')
    .select('id, status, beauty_offers!inner(expires_at)')
    .eq('qr_code_secret', secret)
    .single()

  if (fetchError || !purchase) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
  }

  if (purchase.status !== 'active') {
    return NextResponse.json(
      { error: purchase.status === 'redeemed' ? 'Already redeemed' : `Cannot redeem — status is ${purchase.status}` },
      { status: 400 }
    )
  }

  // Check expiry
  const offer = purchase.beauty_offers as unknown as { expires_at: string }
  if (new Date(offer.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This offer has expired' }, { status: 400 })
  }

  // Get client IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Redeem
  const { error: updateError } = await supabase
    .from('beauty_purchases')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redeemed_by_ip: ip,
    })
    .eq('id', purchase.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to redeem' }, { status: 500 })
  }

  return NextResponse.json({ success: true, purchase_id: purchase.id })
}
