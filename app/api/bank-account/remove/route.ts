import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(req: NextRequest) {
  try {
    const { accountId } = await req.json()

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Get current user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the account belongs to the user
    const { data: account, error: accountError } = await supabase
      .from('user_bank_accounts')
      .select('id, is_primary')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      )
    }

    // Check if this is the only account
    const { data: allAccounts, error: countError } = await supabase
      .from('user_bank_accounts')
      .select('id')
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting accounts:', countError)
      return NextResponse.json(
        { error: 'Failed to verify account status' },
        { status: 500 }
      )
    }

    // If this is the primary account and there are other accounts, set another as primary
    if (account.is_primary && allAccounts.length > 1) {
      const { data: otherAccount, error: otherAccountError } = await supabase
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .neq('id', accountId)
        .eq('status', 'verified')
        .limit(1)
        .single()

      if (otherAccountError) {
        // No other verified account available, just proceed with deletion
        console.log('No other verified account to set as primary')
      } else {
        // Set another account as primary
        await supabase
          .from('user_bank_accounts')
          .update({ is_primary: true })
          .eq('id', otherAccount.id)
      }
    }

    // Delete the account
    const { error: deleteError } = await supabase
      .from('user_bank_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting bank account:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove bank account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account removed successfully'
    })

  } catch (error) {
    console.error('Remove bank account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}