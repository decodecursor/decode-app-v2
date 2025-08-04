import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { accountId, userId } = await request.json()

    if (!accountId || !userId) {
      return NextResponse.json(
        { error: 'Account ID and User ID are required' },
        { status: 400 }
      )
    }

    // First, set all other accounts as non-primary
    const { error: updateAllError } = await supabase
      .from('user_bank_accounts')
      .update({ is_primary: false })
      .eq('user_id', userId)

    if (updateAllError) {
      throw updateAllError
    }

    // Then set the selected account as primary
    const { data, error } = await supabase
      .from('user_bank_accounts')
      .update({ is_primary: true })
      .eq('id', accountId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      account: data
    })

  } catch (error) {
    console.error('Error setting primary bank account:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set primary account' },
      { status: 500 }
    )
  }
}