import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { stripeService } from '@/lib/stripe'
import { USER_ROLES } from '@/types/user'

const LOG_PREFIX = '[OFFER-PI]'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify Buyer role
    const adminClient = createServiceRoleClient()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, role, email, user_name')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== USER_ROLES.BUYER) {
      return NextResponse.json({ error: 'Only buyers can purchase offers' }, { status: 403 })
    }

    // 3. Parse request
    const { offerId } = await request.json()
    if (!offerId) {
      return NextResponse.json({ error: 'Missing offerId' }, { status: 400 })
    }

    // 4. Validate offer
    const { data: offer, error: offerError } = await adminClient
      .from('beauty_offers')
      .select('*, beauty_businesses!inner(id, business_name, creator_id)')
      .eq('id', offerId)
      .eq('is_active', true)
      .single()

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found or no longer available' }, { status: 404 })
    }

    if (new Date(offer.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This offer has expired' }, { status: 400 })
    }

    if (offer.quantity_sold >= offer.quantity) {
      return NextResponse.json({ error: 'This offer is sold out' }, { status: 400 })
    }

    const business = offer.beauty_businesses as any
    const amountInFils = Math.round(offer.price * 100)

    // 5. Create Stripe PaymentIntent with AED currency
    stripeService.ensureStripeInitialized()
    const paymentIntent = await stripeService.stripe.paymentIntents.create({
      amount: amountInFils,
      currency: 'aed',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'beauty_offer',
        offer_id: offerId,
        buyer_id: user.id,
        business_id: business.id,
      },
      receipt_email: user.email || userProfile.email,
      description: `${offer.title} — ${business.business_name}`,
    })

    console.log(`${LOG_PREFIX} PaymentIntent created: ${paymentIntent.id} for offer ${offerId}`)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      offerDetails: {
        title: offer.title,
        businessName: business.business_name,
        price: offer.price,
      },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
