import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { stripeService } from '@/lib/stripe'
import { USER_ROLES } from '@/types/user'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Zombie check — verify public.users row with Buyer role
    const adminClient = createServiceRoleClient()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== USER_ROLES.BUYER) {
      return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 })
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

    // Check expiry
    if (new Date(offer.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This offer has expired' }, { status: 400 })
    }

    // Check quantity
    if (offer.quantity_sold >= offer.quantity) {
      return NextResponse.json({ error: 'This offer is sold out' }, { status: 400 })
    }

    const business = offer.beauty_businesses as any
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // 5. Create Stripe Checkout Session
    stripeService.ensureStripeInitialized()
    const session = await stripeService.stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'aed',
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: {
              name: offer.title,
              description: `${business.business_name} — Beauty Offer`,
            },
            unit_amount: Math.round(offer.price * 100), // AED to fils
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'beauty_offer',
        offer_id: offerId,
        buyer_id: user.id,
        business_id: business.id,
      },
      payment_intent_data: {
        metadata: {
          type: 'beauty_offer',
          offer_id: offerId,
          buyer_id: user.id,
          business_id: business.id,
        },
      },
      success_url: `${siteUrl}/offers/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/offers/${offerId}`,
      customer_email: user.email,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[BEAUTY-OFFER] Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Retrieve session from Stripe
    stripeService.ensureStripeInitialized()
    const session = await stripeService.stripe.checkout.sessions.retrieve(sessionId)

    // Verify this session belongs to the requesting user
    if (session.metadata?.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get offer details
    const adminClient = createServiceRoleClient()
    const { data: offer } = await adminClient
      .from('beauty_offers')
      .select('title, price, beauty_businesses!inner(business_name)')
      .eq('id', session.metadata?.offer_id)
      .single()

    const business = (offer?.beauty_businesses as any)

    return NextResponse.json({
      status: session.payment_status,
      offer_title: offer?.title || 'Beauty Offer',
      business_name: business?.business_name || '',
      amount_paid: offer?.price || (session.amount_total ? session.amount_total / 100 : 0),
      currency: 'AED',
    })
  } catch (error) {
    console.error('[BEAUTY-OFFER] Session retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    )
  }
}
