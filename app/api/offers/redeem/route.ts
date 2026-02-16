import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { emailService } from '@/lib/email-service'

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

  // Auth check
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // Fetch purchase
  const { data: purchase, error: fetchError } = await supabase
    .from('beauty_purchases')
    .select('id, status, amount_paid, buyer_id, beauty_offers!inner(title, price, expires_at), beauty_businesses!inner(business_name, creator_id), users!beauty_purchases_buyer_id_fkey(user_name, email)')
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
  const offer = purchase.beauty_offers as unknown as { title: string; price: number; expires_at: string }
  const business = purchase.beauty_businesses as unknown as { business_name: string; creator_id: string }
  const buyer = purchase.users as unknown as { user_name: string; email: string } | null
  // Ownership check
  if (business.creator_id !== user.id) {
    return NextResponse.json({
      error: 'wrong_salon',
      business_name: business.business_name
    }, { status: 403 })
  }

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

  // Send redemption emails (non-blocking)
  const buyerName = buyer?.user_name || 'Customer'
  const LOG_PREFIX = '[REDEEM]'

  // Buyer email
  if (buyer?.email) {
    emailService.send({
      to: buyer.email,
      subject: `Offer Redeemed — ${offer.title}`,
      html: `
        <h2>Your offer has been redeemed!</h2>
        <p>Your offer "<strong>${offer.title}</strong>" at ${business.business_name} has been redeemed.</p>
        <p>Amount: AED ${offer.price}</p>
        <p>Purchase ID: <strong>${purchase.id.slice(0, 8).toUpperCase()}</strong></p>
        <p style="font-size:11px;color:#999;">Full ref: ${purchase.id}</p>
        <p>The DECODE Team wishes you a wonderful week.</p>
      `,
    }).catch(err => console.error(`${LOG_PREFIX} Buyer email failed:`, err))
  }

  // Salon admin email
  const { data: salonAdmin } = await supabase
    .from('users')
    .select('email, user_name')
    .eq('id', business.creator_id)
    .single()

  if (salonAdmin?.email) {
    emailService.send({
      to: salonAdmin.email,
      subject: `Offer Redeemed — ${offer.title} - ${purchase.id.slice(0, 8).toUpperCase()}`,
      html: `
        <h2>Offer redeemed!</h2>
        <p>${buyerName} has redeemed "<strong>${offer.title}</strong>".</p>
        <p>Amount: AED ${offer.price}</p>
        <p>Purchase ID: <strong>${purchase.id.slice(0, 8).toUpperCase()}</strong></p>
        <p style="font-size:11px;color:#999;">Full ref: ${purchase.id}</p>
        <p>The DECODE Team wishes you a wonderful week.</p>
      `,
    }).catch(err => console.error(`${LOG_PREFIX} Salon email failed:`, err))
  }

  // Platform admin email
  emailService.send({
    to: 'sebastian@welovedecode.com',
    subject: `Offer Redeemed — ${offer.title}`,
    html: `
      <h2>Offer redeemed</h2>
      <p>${buyerName} redeemed "<strong>${offer.title}</strong>" at ${business.business_name}.</p>
      <p>Amount: AED ${offer.price}</p>
      <p>Purchase ID: <strong>${purchase.id.slice(0, 8).toUpperCase()}</strong></p>
      <p style="font-size:11px;color:#999;">Full ref: ${purchase.id}</p>
    `,
  }).catch(err => console.error(`${LOG_PREFIX} Admin email failed:`, err))

  return NextResponse.json({ success: true, purchase_id: purchase.id })
}
