import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserWithProxy } from '@/utils/auth-helper'

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET - Retrieve user's PayPal account information
export async function GET() {
  try {
    const { user } = await getUserWithProxy()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get user's PayPal account
    const { data: paypalAccount, error } = await supabase
      .from('user_paypal_account')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching PayPal account:', error)
      return NextResponse.json(
        { error: 'Failed to fetch PayPal account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: paypalAccount || null
    })

  } catch (error) {
    console.error('PayPal account GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save new PayPal account data
export async function POST(request: Request) {
  try {
    const { user } = await getUserWithProxy()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, confirm_email } = body

    // Validate required fields
    if (!email?.trim()) {
      return NextResponse.json(
        { error: 'PayPal email address is required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate email confirmation if provided
    if (confirm_email && email.trim() !== confirm_email.trim()) {
      return NextResponse.json(
        { error: 'Email addresses do not match' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user already has a PayPal account
    const { data: existingAccount } = await supabase
      .from('user_paypal_account')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: 'PayPal account already exists. Use PUT to update.' },
        { status: 409 }
      )
    }

    // Insert new PayPal account
    const { data: newAccount, error: insertError } = await supabase
      .from('user_paypal_account')
      .insert({
        user_id: user.id,
        email: email.trim().toLowerCase(),
        is_primary: true,
        is_verified: false,
        status: 'pending',
        paypal_account_id: null
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting PayPal account:', insertError)
      return NextResponse.json(
        { error: 'Failed to save PayPal account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newAccount,
      message: 'PayPal account added successfully'
    })

  } catch (error) {
    console.error('PayPal account POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update existing PayPal account
export async function PUT(request: Request) {
  try {
    const { user } = await getUserWithProxy()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, confirm_email } = body

    // Validate required fields
    if (!email?.trim()) {
      return NextResponse.json(
        { error: 'PayPal email address is required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate email confirmation if provided
    if (confirm_email && email.trim() !== confirm_email.trim()) {
      return NextResponse.json(
        { error: 'Email addresses do not match' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update existing PayPal account
    const { data: updatedAccount, error: updateError } = await supabase
      .from('user_paypal_account')
      .update({
        email: email.trim().toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating PayPal account:', updateError)
      return NextResponse.json(
        { error: 'Failed to update PayPal account' },
        { status: 500 }
      )
    }

    if (!updatedAccount) {
      return NextResponse.json(
        { error: 'PayPal account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: 'PayPal account updated successfully'
    })

  } catch (error) {
    console.error('PayPal account PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove PayPal account
export async function DELETE() {
  try {
    const { user } = await getUserWithProxy()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Delete PayPal account
    const { error: deleteError } = await supabase
      .from('user_paypal_account')
      .delete()
      .eq('user_id', user.id)
      .eq('is_primary', true)

    if (deleteError) {
      console.error('Error deleting PayPal account:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete PayPal account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'PayPal account removed successfully'
    })

  } catch (error) {
    console.error('PayPal account DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}