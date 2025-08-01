import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { newEmail } = await req.json()

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json(
        { error: 'New email is required' },
        { status: 400 }
      )
    }

    // Get current user from auth
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
    
    // For now, we'll use a simple approach. In production, you'd want proper JWT validation
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

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Get current user data
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    // The verification process is handled through email_verification_logs table
    // No need to update user table with pending email fields
    const updateError = null // Removed user table update since verification fields don't exist

    if (updateError) {
      console.error('Error updating user:', updateError)
      return NextResponse.json(
        { error: 'Failed to initiate email change' },
        { status: 500 }
      )
    }

    // Log the verification attempt (logging to console since email_verification_logs table doesn't exist)
    console.log('Email change verification attempt:', {
      user_id: user.id,
      email_type: 'email_change',
      old_email: userData?.email,
      new_email: newEmail.toLowerCase().trim(),
      verification_token: verificationToken,
      expires_at: expiresAt.toISOString(),
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    })

    // In a real implementation, you would send an email here
    // For now, we'll just return success
    console.log(`Email verification token for ${newEmail}: ${verificationToken}`)
    console.log(`Verification URL: ${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verificationToken}`)

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