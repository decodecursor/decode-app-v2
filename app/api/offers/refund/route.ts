import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { emailService } from '@/lib/email-service'

const REFUND_WINDOW_DAYS = 3
const ADMIN_EMAIL = 'sebastian@welovedecode.com'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { purchaseId } = await request.json()
    if (!purchaseId) {
      return NextResponse.json({ error: 'Missing purchaseId' }, { status: 400 })
    }

    const adminClient = createServiceRoleClient()

    // 2. Verify purchase
    const { data: purchase, error: purchaseError } = await adminClient
      .from('beauty_purchases')
      .select('*, beauty_offers!inner(title, price), beauty_businesses!inner(business_name, creator_id)')
      .eq('id', purchaseId)
      .eq('buyer_id', user.id)
      .single()

    if (purchaseError || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    if (purchase.status !== 'active') {
      return NextResponse.json({ error: 'Purchase is not eligible for refund' }, { status: 400 })
    }

    if (purchase.refund_requested_at) {
      return NextResponse.json({ error: 'Refund already requested' }, { status: 400 })
    }

    // Check 7-day window
    const purchaseDate = new Date(purchase.created_at)
    const now = new Date()
    const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSincePurchase > REFUND_WINDOW_DAYS) {
      return NextResponse.json({ error: 'Refund window has expired (3 days)' }, { status: 400 })
    }

    // 3. Mark refund requested
    const { error: updateError } = await adminClient
      .from('beauty_purchases')
      .update({ refund_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', purchaseId)

    if (updateError) {
      console.error('[BEAUTY-OFFER] Failed to update purchase:', updateError)
      return NextResponse.json({ error: 'Failed to process refund request' }, { status: 500 })
    }

    // 4. Send emails (non-blocking)
    const offer = purchase.beauty_offers as any
    const business = purchase.beauty_businesses as any

    // Get buyer info
    const { data: buyerUser } = await adminClient
      .from('users')
      .select('email, user_name')
      .eq('id', user.id)
      .single()

    // Get salon admin email
    const { data: salonAdmin } = await adminClient
      .from('users')
      .select('email, user_name')
      .eq('id', business.creator_id)
      .single()

    const buyerEmail = buyerUser?.email

    // Buyer email
    if (buyerEmail) {
      emailService.send({
        to: buyerEmail,
        subject: `Refund Request Received — ${offer.title}`,
        html: `
          <h2>We've received your refund request</h2>
          <p>Your refund request for <strong>${offer.title}</strong> at ${business.business_name} is being reviewed.</p>
          <p>We'll update you within 1–2 business days.</p>
        `,
      }).catch(err => console.error('[BEAUTY-OFFER] Buyer refund email failed:', err))
    }

    // Admin email
    emailService.send({
      to: ADMIN_EMAIL,
      subject: `Refund Request — ${offer.title}`,
      html: `
        <h2>New refund request</h2>
        <p><strong>Offer:</strong> ${offer.title}</p>
        <p><strong>Salon:</strong> ${business.business_name}</p>
        <p><strong>Buyer:</strong> ${buyerUser?.user_name || buyerEmail || 'Unknown'} (${buyerEmail || 'no email'})</p>
        <p><strong>Amount:</strong> AED ${offer.price}</p>
        <p><strong>Purchase ID:</strong> ${purchaseId}</p>
        <p><strong>Stripe PI:</strong> ${purchase.stripe_payment_intent_id || 'N/A'}</p>
        <p><strong>Purchased:</strong> ${new Date(purchase.created_at).toLocaleString()}</p>
      `,
    }).catch(err => console.error('[BEAUTY-OFFER] Admin refund email failed:', err))

    // Salon admin email
    if (salonAdmin?.email) {
      emailService.send({
        to: salonAdmin.email,
        subject: `Refund Requested — ${offer.title}`,
        html: `
          <h2>A customer has requested a refund</h2>
          <p><strong>Offer:</strong> ${offer.title}</p>
          <p><strong>Buyer:</strong> ${buyerUser?.user_name || buyerEmail || 'Unknown'}</p>
          <p><strong>Amount:</strong> AED ${offer.price}</p>
          <p>The DECODE team will review this request and process it within 1–2 business days.</p>
        `,
      }).catch(err => console.error('[BEAUTY-OFFER] Salon refund email failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BEAUTY-OFFER] Refund request error:', error)
    return NextResponse.json({ error: 'Failed to process refund request' }, { status: 500 })
  }
}
