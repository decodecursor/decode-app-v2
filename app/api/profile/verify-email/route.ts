import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    // Email verification functionality is not implemented yet
    // The required database fields don't exist in the current schema
    console.log('Email verification attempted with token:', token)
    
    return NextResponse.json(
      { error: 'Email verification feature is not available yet' },
      { status: 501 }
    )


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