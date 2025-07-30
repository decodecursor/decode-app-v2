import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const {
      bank_name,
      account_holder_name,
      account_number,
      routing_number,
      iban,
      swift_code,
      account_type,
      is_primary
    } = await req.json()

    // Get current user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!bank_name || !account_holder_name || !account_number) {
      return NextResponse.json(
        { error: 'Bank name, account holder name, and account number are required' },
        { status: 400 }
      )
    }

    // Validate account type specific fields
    if (account_type === 'domestic' && !routing_number) {
      return NextResponse.json(
        { error: 'Routing number is required for domestic accounts' },
        { status: 400 }
      )
    }

    if (account_type === 'international' && !iban && !swift_code) {
      return NextResponse.json(
        { error: 'Either IBAN or SWIFT code is required for international accounts' },
        { status: 400 }
      )
    }

    // Check if account number already exists for this user
    const { data: existingAccount } = await supabase
      .from('user_bank_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('account_number', account_number)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: 'This account number is already registered' },
        { status: 400 }
      )
    }

    // Insert new bank account
    const { data: newAccount, error: insertError } = await supabase
      .from('user_bank_accounts')
      .insert({
        user_id: user.id,
        bank_name: bank_name.trim(),
        account_holder_name: account_holder_name.trim(),
        account_number: account_number.trim(),
        routing_number: routing_number?.trim() || null,
        iban: iban?.trim() || null,
        swift_code: swift_code?.trim() || null,
        is_primary: Boolean(is_primary),
        status: 'pending',
        verification_method: 'manual' // Can be updated later for automated verification
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting bank account:', insertError)
      return NextResponse.json(
        { error: 'Failed to add bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account added successfully',
      account: newAccount
    })

  } catch (error) {
    console.error('Bank account add error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}