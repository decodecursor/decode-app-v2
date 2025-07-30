import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
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

    // Verify the account belongs to the user and is verified
    const { data: account, error: accountError } = await supabase
      .from('user_bank_accounts')
      .select('id, status, is_primary')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      )
    }

    if (account.status !== 'verified') {
      return NextResponse.json(
        { error: 'Only verified accounts can be set as primary' },
        { status: 400 }
      )
    }

    if (account.is_primary) {
      return NextResponse.json(
        { error: 'This account is already primary' },
        { status: 400 }
      )
    }

    // The database trigger will handle setting other accounts to non-primary
    const { error: updateError } = await supabase
      .from('user_bank_accounts')
      .update({ is_primary: true })
      .eq('id', accountId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error setting primary account:', updateError)
      return NextResponse.json(
        { error: 'Failed to set primary account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Primary account updated successfully'
    })

  } catch (error) {
    console.error('Set primary account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}