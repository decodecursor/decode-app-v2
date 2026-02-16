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

    // 4. Send emails
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

    // Send emails — must await to prevent serverless runtime from killing promises
    const emailPromises: Promise<any>[] = []

    if (buyerEmail) {
      emailPromises.push(
        emailService.send({
          to: buyerEmail,
          subject: `Refund Request — ${offer.title}`,
          html: `
            <p>Your refund request for <strong>${offer.title}</strong> at ${business.business_name} is being reviewed.</p>
            <p>We'll update you within 1–2 business days.</p>
            <p><strong>Purchase ID:</strong> ${purchaseId}</p>
          `,
        })
      )
    }

    emailPromises.push(
      emailService.send({
        to: ADMIN_EMAIL,
        subject: `Refund Request — ${business.business_name} - ${offer.title}`,
        html: `
          <h2>New refund request</h2>
          <p><strong>Offer:</strong> ${offer.title}</p>
          <p><strong>Business:</strong> ${business.business_name}</p>
          <p><strong>Buyer:</strong> ${buyerUser?.user_name || buyerEmail || 'Unknown'} (${buyerEmail || 'no email'})</p>
          <p><strong>Amount:</strong> AED ${offer.price}</p>
          <p><strong>Purchase ID:</strong> ${purchaseId}</p>
          <p><strong>Purchase date:</strong> ${new Date(purchase.created_at).toLocaleString()}</p>
          <p><strong>Stripe PI:</strong> ${purchase.stripe_payment_intent_id || 'N/A'}</p>
        `,
      })
    )

    if (salonAdmin?.email) {
      emailPromises.push(
        emailService.send({
          to: salonAdmin.email,
          subject: `Refund Request — ${offer.title} - ${buyerUser?.user_name || buyerEmail || 'Unknown'}`,
          html: `
            <h2>New refund request</h2>
            <p><strong>Offer:</strong> ${offer.title}</p>
            <p><strong>Buyer:</strong> ${buyerUser?.user_name || buyerEmail || 'Unknown'}</p>
            <p><strong>Amount:</strong> AED ${offer.price}</p>
            <p><strong>Purchase ID:</strong> ${purchaseId}</p>
            <p>The DECODE team will review this request and process it within 1–2 business days.</p>
          `,
        })
      )
    }

    const emailResults = await Promise.allSettled(emailPromises)
    const emailsFailed = emailResults.filter(r => r.status === 'rejected')
    if (emailsFailed.length > 0) {
      console.error('[BEAUTY-OFFER] Some refund emails failed:', emailsFailed)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BEAUTY-OFFER] Refund request error:', error)
    return NextResponse.json({ error: 'Failed to process refund request' }, { status: 500 })
  }
}
