import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  console.log('🔍 DEBUG: Starting create-crossmint-order API call')
  
  try {
    const { paymentLinkId } = await request.json()
    console.log('🔍 DEBUG: Received paymentLinkId:', paymentLinkId)

    if (!paymentLinkId) {
      console.log('❌ DEBUG: No paymentLinkId provided')
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      )
    }

    // Debug environment variables
    console.log('🔍 DEBUG: Environment variables check:')
    console.log('- CROSSMINT_API_KEY:', process.env.CROSSMINT_API_KEY ? 'SET' : 'MISSING')
    console.log('- NEXT_PUBLIC_CROSSMINT_PROJECT_ID:', process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID ? 'SET' : 'MISSING')

    // Get payment link data using anon key (since service role key has issues)
    console.log('🔍 DEBUG: Querying payment_links table for ID:', paymentLinkId)
    
    const { data: paymentLink, error: linkError } = await supabase
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

    console.log('🔍 DEBUG: Supabase query result:')
    console.log('- Error:', linkError)
    console.log('- Data:', paymentLink)

    if (linkError) {
      console.log('❌ DEBUG: Supabase error details:', JSON.stringify(linkError, null, 2))
      return NextResponse.json(
        { 
          error: 'Payment link not found',
          debug: {
            supabaseError: linkError,
            paymentLinkId: paymentLinkId
          }
        },
        { status: 404 }
      )
    }

    if (!paymentLink) {
      console.log('❌ DEBUG: No payment link data returned')
      return NextResponse.json(
        { 
          error: 'Payment link not found',
          debug: {
            message: 'No data returned from query',
            paymentLinkId: paymentLinkId
          }
        },
        { status: 404 }
      )
    }

    if (!paymentLink.is_active) {
      console.log('❌ DEBUG: Payment link is inactive')
      return NextResponse.json(
        { error: 'Payment link is inactive' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expirationDate = new Date(paymentLink.expiration_date)
    if (now > expirationDate) {
      console.log('❌ DEBUG: Payment link has expired')
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      )
    }

    // Transform creator data
    const creator = Array.isArray(paymentLink.creator) 
      ? (paymentLink.creator[0] || { full_name: null, email: '' })
      : (paymentLink.creator || { full_name: null, email: '' })

    // Convert AED to USD for Crossmint (approximate rate: 1 AED = 0.27 USD)
    const amountUSD = Math.round(paymentLink.amount_aed * 0.27 * 100) // Convert to cents

    console.log('🔍 DEBUG: Creating Crossmint order with amount:', amountUSD, 'cents USD')

    // Create order with Crossmint API - simple fiat payment structure
    const crossmintPayload = {
      lineItems: [
        {
          collectionLocator: `crossmint:${process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID}`,
          callData: {
            totalPrice: amountUSD.toString(),
            currency: 'USD',
            quantity: 1
          },
          metadata: {
            title: paymentLink.title,
            description: `Beauty service: ${paymentLink.title}`,
            paymentLinkId: paymentLinkId,
            beautyProfessionalId: creator.email,
            service: 'beauty',
            originalAmount: paymentLink.amount_aed,
            originalCurrency: 'AED'
          }
        }
      ],
      payment: {
        method: 'stripe-payment-element',
        currency: 'USD'
      },
      successCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?paymentLinkId=${paymentLinkId}`,
      failureCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/failed?paymentLinkId=${paymentLinkId}`
    }

    console.log('🔍 DEBUG: Crossmint payload:', JSON.stringify(crossmintPayload, null, 2))

    const crossmintResponse = await fetch('https://www.crossmint.com/api/2022-06-09/orders', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.CROSSMINT_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(crossmintPayload)
    })

    console.log('🔍 DEBUG: Crossmint response status:', crossmintResponse.status)

    if (!crossmintResponse.ok) {
      const errorText = await crossmintResponse.text()
      console.error('❌ DEBUG: Crossmint API error:', errorText)
      
      return NextResponse.json(
        { 
          error: 'Failed to create payment order',
          debug: {
            crossmintError: errorText,
            status: crossmintResponse.status
          }
        },
        { status: 500 }
      )
    }

    const crossmintOrder = await crossmintResponse.json()
    console.log('✅ DEBUG: Crossmint order created:', crossmintOrder)

    return NextResponse.json({
      success: true,
      order: crossmintOrder,
      paymentLink: {
        id: paymentLink.id,
        title: paymentLink.title,
        amount_aed: paymentLink.amount_aed,
        amount_usd: amountUSD / 100, // Convert back to dollars for display
        creator: creator
      }
    })

  } catch (error) {
    console.error('❌ DEBUG: Caught error in create-crossmint-order API:', error)
    console.error('❌ DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error
        }
      },
      { status: 500 }
    )
  }
}