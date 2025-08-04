import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(request: NextRequest) {
  try {
    const { accountId, userId } = await request.json()

    if (!accountId || !userId) {
      return NextResponse.json(
        { error: 'Account ID and User ID are required' },
        { status: 400 }
      )
    }

    // Check if this is the primary account
    const { data: account, error: checkError } = await supabase
      .from('user_bank_accounts')
      .select('is_primary')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (checkError) {
      throw checkError
    }

    if (account?.is_primary) {
      // If removing primary, set another account as primary
      const { data: otherAccounts } = await supabase
        .from('user_bank_accounts')
        .select('id')
        .eq('user_id', userId)
        .neq('id', accountId)
        .limit(1)

      if (otherAccounts && otherAccounts.length > 0) {
        await supabase
          .from('user_bank_accounts')
          .update({ is_primary: true })
          .eq('id', otherAccounts[0].id)
      }
    }

    // Remove the bank account
    const { error } = await supabase
      .from('user_bank_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account removed successfully'
    })

  } catch (error) {
    console.error('Error removing bank account:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove bank account' },
      { status: 500 }
    )
  }
}