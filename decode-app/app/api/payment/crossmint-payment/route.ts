import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any

export async function POST(request: NextRequest) {
  try {
    const { paymentLinkId, amount, currency = 'USD' } = await request.json()

    if (!paymentLinkId || !amount) {
      return NextResponse.json(
        { error: 'Payment link ID and amount are required' },
        { status: 400 }
      )
    }

    // Validate payment link
    const { data: paymentLink, error: linkError } = await supabaseAdmin
      .from('payment_links')
      .select(`
        id,
        title,
        amount_aed,
        expiration_date,
        is_active,
        creator:creator_id (
          user_name,
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
      ? (paymentLink.creator[0] || { user_name: null, email: '' })
      : (paymentLink.creator || { user_name: null, email: '' })

    // Create payment with Crossmint API
    const crossmintPayload = {
      payment: {
        currency: currency,
        amount: amount.toString(), // Amount in cents/smallest unit
        successCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success`,
        failureCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/failed`
      },
      metadata: {
        paymentLinkId: paymentLinkId,
        beautyProfessionalId: creator.email,
        service: 'beauty',
        title: paymentLink.title,
        originalAmount: paymentLink.amount_aed,
        originalCurrency: 'AED'
      }
    }

    const crossmintResponse = await fetch('https://www.crossmint.com/api/2022-06-09/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CROSSMINT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(crossmintPayload)
    })

    if (!crossmintResponse.ok) {
      const errorData = await crossmintResponse.text()
      console.error('Crossmint API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to create payment with Crossmint' },
        { status: 500 }
      )
    }

    const crossmintOrder = await crossmintResponse.json()

    return NextResponse.json({
      success: true,
      order: crossmintOrder,
      paymentLink: {
        id: paymentLink.id,
        title: paymentLink.title,
        amount_aed: paymentLink.amount_aed,
        creator: creator
      }
    })

  } catch (error) {
    console.error('Error creating Crossmint payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}