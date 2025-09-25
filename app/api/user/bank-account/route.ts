import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET - Retrieve user's bank account information
export async function GET() {
  try {
    console.log('📥 [BANK-ACCOUNT-API] GET request received')
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('❌ [BANK-ACCOUNT-API] GET Authentication error:', authError)
      return NextResponse.json(
        { error: 'Not authenticated', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.error('❌ [BANK-ACCOUNT-API] GET No user found in session')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('✅ [BANK-ACCOUNT-API] GET User authenticated:', {
      userId: user.id,
      userEmail: user.email
    })

    // Get user's primary bank account (optimized single query)
    const { data: bankAccount, error } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('❌ [BANK-ACCOUNT-API] GET Error fetching bank account:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bank account', details: error.message },
        { status: 500 }
      )
    }

    // If no manual bank account found, check for Stripe Connect as fallback
    if (!bankAccount) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('stripe_connect_status, user_name')
        .eq('id', user.id)
        .single()

      if (userProfile?.stripe_connect_status === 'active') {
        const stripeAccount = {
          id: 'stripe',
          iban_number: '****connected',
          bank_name: 'Stripe Connect',
          beneficiary_name: userProfile.user_name || 'User',
          is_verified: true,
          status: 'active'
        }

        return NextResponse.json({
          success: true,
          data: stripeAccount
        })
      }
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
    console.log('📥 [BANK-ACCOUNT-API] POST request received')
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('❌ [BANK-ACCOUNT-API] Authentication error:', authError)
      return NextResponse.json(
        { error: 'Not authenticated', details: authError.message },
        { status: 401 }
      )
    }

    if (!user) {
      console.error('❌ [BANK-ACCOUNT-API] No user found in session')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('✅ [BANK-ACCOUNT-API] User authenticated:', {
      userId: user.id,
      userEmail: user.email
    })

    const body = await request.json()
    const { beneficiary_name, iban_number, bank_name } = body

    // Validate required fields
    if (!beneficiary_name?.trim() || !iban_number?.trim() || !bank_name?.trim()) {
      return NextResponse.json(
        { error: 'Beneficiary name, IBAN, and bank name are required' },
        { status: 400 }
      )
    }

    // Check if user already has bank accounts and clean them up
    console.log('🔍 [BANK-ACCOUNT-API] Checking for existing bank accounts for user:', user.id)
    const { data: existingAccounts, error: checkError } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)

    if (checkError) {
      console.error('❌ [BANK-ACCOUNT-API] Error checking existing accounts:', {
        error: checkError,
        errorCode: checkError.code,
        errorMessage: checkError.message,
        userId: user.id
      })
    }

    if (existingAccounts && existingAccounts.length > 0) {
      console.log(`⚠️ [BANK-ACCOUNT-API] User has ${existingAccounts.length} existing bank account(s), will replace with new one`)

      // Delete all existing primary accounts for this user to avoid duplicates
      const { error: deleteError } = await supabase
        .from('user_bank_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('is_primary', true)

      if (deleteError) {
        console.error('❌ [BANK-ACCOUNT-API] Error deleting old accounts:', deleteError)
      } else {
        console.log('✅ [BANK-ACCOUNT-API] Cleaned up old bank accounts')
      }
    }

    console.log('✅ [BANK-ACCOUNT-API] Ready to insert new bank account')

    // Insert new bank account
    console.log('💾 [BANK-ACCOUNT-API] Attempting to insert:', {
      user_id: user.id,
      beneficiary_name: beneficiary_name.trim(),
      iban_number: iban_number.trim(),
      bank_name: bank_name.trim(),
      is_primary: true,
      is_verified: false,
      status: 'pending'
    })
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
      console.error('❌ [BANK-ACCOUNT-API] Error inserting bank account:', {
        error: insertError,
        errorCode: insertError.code,
        errorMessage: insertError.message,
        errorDetails: insertError.details,
        userId: user.id,
        userEmail: user.email,
        requestData: { beneficiary_name, iban_number, bank_name }
      })
      return NextResponse.json(
        {
          error: 'Failed to save bank account',
          details: insertError.message,
          code: insertError.code
        },
        { status: 500 }
      )
    }

    console.log('✅ [BANK-ACCOUNT-API] Bank account created successfully:', newAccount.id)

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
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
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
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

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