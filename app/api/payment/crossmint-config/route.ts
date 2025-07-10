import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { paymentLinkId } = await request.json()

    if (!paymentLinkId) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      )
    }

    // Validate payment link exists and is active
    const { data: paymentLink, error: linkError } = await supabaseAdmin
      .from('payment_links')
      .select(`
        id,
        title,
        amount_aed,
        expiration_date,
        is_active,
        creator:creator_id (
          full_name,
          email
        )
      `)
      .eq('id', paymentLinkId)
      .single()

    if (linkError || !paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      )
    }

    if (!paymentLink.is_active) {
      return NextResponse.json(
        { error: 'Payment link is inactive' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expirationDate = new Date(paymentLink.expiration_date)
    if (now > expirationDate) {
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      )
    }

    // Transform creator data
    const creator = Array.isArray(paymentLink.creator) 
      ? (paymentLink.creator[0] || { full_name: null, email: '' })
      : (paymentLink.creator || { full_name: null, email: '' })

    // Create payment configuration for Crossmint
    const crossmintConfig = {
      projectId: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID,
      environment: 'production',
      currency: 'USD',
      locale: 'en-US',
      paymentMethod: 'fiat',
      // Convert AED to USD for Crossmint (approximate rate)
      amount: Math.round(paymentLink.amount_aed * 0.27 * 100), // Convert to cents
      metadata: {
        paymentLinkId: paymentLinkId,
        beautyProfessionalId: creator.email,
        service: 'beauty',
        title: paymentLink.title,
        originalAmount: paymentLink.amount_aed,
        originalCurrency: 'AED'
      }
    }

    return NextResponse.json({
      success: true,
      config: crossmintConfig,
      paymentLink: {
        id: paymentLink.id,
        title: paymentLink.title,
        amount_aed: paymentLink.amount_aed,
        creator: creator
      }
    })

  } catch (error) {
    console.error('Error creating Crossmint config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}