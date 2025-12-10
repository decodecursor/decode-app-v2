import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { newEmail } = await req.json()

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json(
        { error: 'New email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Get current user from auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if email is already in use
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', newEmail.toLowerCase().trim())
      .single()

    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json(
        { error: 'Email address is already in use' },
        { status: 400 }
      )
    }

    console.log('📧 Attempting email change for user:', user.id)
    console.log('📧 Old email:', user.email)
    console.log('📧 New email:', newEmail.toLowerCase().trim())

    // Use Supabase auth to update email (sends verification email automatically)
    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail.toLowerCase().trim() },
      {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.welovedecode.com'}/auth/verify`
      }
    )

    if (updateError) {
      console.error('❌ Email change error:', updateError)

      // Map common errors to user-friendly messages
      let userMessage = updateError.message
      if (updateError.message?.includes('Email rate limit exceeded') || updateError.message?.includes('rate limit')) {
        userMessage = 'Email rate limit reached. Please wait a few minutes before trying again.'
      } else if (updateError.message?.includes('same email')) {
        userMessage = 'This is already your current email address.'
      }

      return NextResponse.json(
        { error: userMessage },
        { status: 400 }
      )
    }

    console.log('✅ Email change initiated successfully - verification email sent to:', newEmail.toLowerCase().trim())

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully'
    })

  } catch (error) {
    console.error('Email change error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}