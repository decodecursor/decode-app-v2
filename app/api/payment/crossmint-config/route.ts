import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createServiceRoleClient();
  console.log('🔍 DEBUG: Starting crossmint-config API call')
  
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
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')
    console.log('- NEXT_PUBLIC_CROSSMINT_PROJECT_ID:', process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID ? 'SET' : 'MISSING')

    // Validate payment link exists and is active
    console.log('🔍 DEBUG: Querying payment_links table for ID:', paymentLinkId)
    
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
    console.error('❌ DEBUG: Caught error in crossmint-config API:', error)
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