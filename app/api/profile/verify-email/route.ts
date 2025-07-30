import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    // Find user with this verification token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, pending_email, verification_token_expires')
      .eq('email_verification_token', token)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (new Date() > new Date(userData.verification_token_expires)) {
      return NextResponse.json(
        { error: 'Verification token has expired' },
        { status: 400 }
      )
    }

    // Update user email and clear verification fields
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email: userData.pending_email,
        email_verified: true,
        pending_email: null,
        email_verification_token: null,
        verification_token_expires: null
      })
      .eq('id', userData.id)

    if (updateError) {
      console.error('Error updating user email:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      )
    }

    // Update verification log
    await supabase
      .from('email_verification_logs')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString()
      })
      .eq('verification_token', token)

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      newEmail: userData.pending_email
    })

  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    // This endpoint can be used for email verification links
    // Redirect to a verification page or handle verification directly
    const verificationResponse = await fetch(`${req.nextUrl.origin}/api/profile/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })

    if (verificationResponse.ok) {
      // Redirect to success page
      return NextResponse.redirect(`${req.nextUrl.origin}/profile?verified=true`)
    } else {
      // Redirect to error page
      return NextResponse.redirect(`${req.nextUrl.origin}/profile?verified=false`)
    }

  } catch (error) {
    console.error('Email verification GET error:', error)
    return NextResponse.redirect(`${req.nextUrl.origin}/profile?error=verification_failed`)
  }
}