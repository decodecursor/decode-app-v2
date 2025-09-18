import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserWithProxy } from '@/utils/auth-helper'

// GET - Retrieve user's bank account information
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

    // Get user's bank account
    const { data: bankAccount, error } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching bank account:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: bankAccount || null
    })

  } catch (error) {
    console.error('Bank account GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save new bank account data
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
    const { beneficiary_name, iban_number, bank_name } = body

    // Validate required fields
    if (!beneficiary_name?.trim() || !iban_number?.trim() || !bank_name?.trim()) {
      return NextResponse.json(
        { error: 'Beneficiary name, IBAN, and bank name are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user already has a bank account
    const { data: existingAccount } = await supabase
      .from('user_bank_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Bank account already exists. Use PUT to update.' },
        { status: 409 }
      )
    }

    // Insert new bank account
    const { data: newAccount, error: insertError } = await supabase
      .from('user_bank_accounts')
      .insert({
        user_id: user.id,
        beneficiary_name: beneficiary_name.trim(),
        iban_number: iban_number.trim(),
        bank_name: bank_name.trim(),
        is_primary: true,
        is_verified: false,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting bank account:', insertError)
      return NextResponse.json(
        { error: 'Failed to save bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newAccount,
      message: 'Bank account added successfully'
    })

  } catch (error) {
    console.error('Bank account POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update existing bank account
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
    const { beneficiary_name, iban_number, bank_name } = body

    // Validate required fields
    if (!beneficiary_name?.trim() || !iban_number?.trim() || !bank_name?.trim()) {
      return NextResponse.json(
        { error: 'Beneficiary name, IBAN, and bank name are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update existing bank account
    const { data: updatedAccount, error: updateError } = await supabase
      .from('user_bank_accounts')
      .update({
        beneficiary_name: beneficiary_name.trim(),
        iban_number: iban_number.trim(),
        bank_name: bank_name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bank account:', updateError)
      return NextResponse.json(
        { error: 'Failed to update bank account' },
        { status: 500 }
      )
    }

    if (!updatedAccount) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: 'Bank account updated successfully'
    })

  } catch (error) {
    console.error('Bank account PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove bank account
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

    // Delete bank account
    const { error: deleteError } = await supabase
      .from('user_bank_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('is_primary', true)

    if (deleteError) {
      console.error('Error deleting bank account:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account removed successfully'
    })

  } catch (error) {
    console.error('Bank account DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}