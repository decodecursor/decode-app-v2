import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ API: Delete payment link endpoint called')

    // Get link ID from request body
    const body = await request.json()
    const { linkId } = body

    if (!linkId) {
      return NextResponse.json(
        { error: 'Payment link ID is required' },
        { status: 400 }
      )
    }

    console.log('🗑️ API: Attempting to delete payment link:', linkId)

    // Create authenticated Supabase client
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('🗑️ API: Authentication error:', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('🗑️ API: User authenticated:', user.id)

    // First, verify the payment link belongs to the user
    const { data: linkData, error: fetchError } = await supabase
      .from('payment_links')
      .select('id, creator_id, title, payment_status, is_active')
      .eq('id', linkId)
      .single()

    if (fetchError) {
      console.error('🗑️ API: Error fetching payment link:', fetchError)
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Payment link not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: `Failed to fetch payment link: ${fetchError.message}` },
        { status: 500 }
      )
    }

    // Check if user is the creator or an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userData?.role === 'Admin'
    const isCreator = linkData.creator_id === user.id

    if (!isCreator && !isAdmin) {
      console.error('🗑️ API: User does not have permission to delete this link')
      return NextResponse.json(
        { error: 'You do not have permission to delete this payment link' },
        { status: 403 }
      )
    }

    console.log('🗑️ API: Permission check passed. User is:', isAdmin ? 'Admin' : 'Creator')

    // Check for COMPLETED transactions only (not pending/failed/cancelled)
    const { data: completedTransactions, error: txError } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('payment_link_id', linkId)
      .eq('status', 'completed')
      .limit(1)

    if (txError) {
      console.error('🗑️ API: Error checking for completed transactions:', txError)
    }

    if (!txError && completedTransactions && completedTransactions.length > 0) {
      console.warn('🗑️ API: Payment link has completed transactions, cannot delete')
      return NextResponse.json(
        {
          error: 'Cannot delete payment link with completed transactions. Only links without successful payments can be deleted.',
          hasTransactions: true
        },
        { status: 400 }
      )
    }

    // Also check for any pending/failed transactions to log for debugging
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('payment_link_id', linkId)

    console.log('🗑️ API: Transaction check summary:', {
      completedTransactions: completedTransactions?.length || 0,
      totalTransactions: allTransactions?.length || 0,
      transactionStatuses: allTransactions?.map(t => t.status) || []
    })

    // Attempt to delete the payment link
    const { data: deleteData, error: deleteError } = await supabase
      .from('payment_links')
      .delete()
      .eq('id', linkId)
      .select()

    if (deleteError) {
      console.error('🗑️ API: Delete error:', deleteError)
      console.error('🗑️ API: Delete error details:', {
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        code: deleteError.code
      })

      // Handle specific error codes
      if (deleteError.code === '23503') {
        return NextResponse.json(
          {
            error: 'Cannot delete: This payment link has related records',
            code: deleteError.code
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: `Failed to delete payment link: ${deleteError.message}`,
          code: deleteError.code
        },
        { status: 500 }
      )
    }

    // Verify deletion was successful
    if (!deleteData || deleteData.length === 0) {
      // Double-check if the link still exists
      const { data: checkData } = await supabase
        .from('payment_links')
        .select('id')
        .eq('id', linkId)
        .single()

      if (checkData) {
        console.error('🗑️ API: Link still exists after delete attempt!')
        return NextResponse.json(
          { error: 'Delete operation failed - link still exists' },
          { status: 500 }
        )
      }
    }

    console.log('✅ API: Payment link deleted successfully:', linkId)

    return NextResponse.json({
      success: true,
      message: 'Payment link deleted successfully',
      deletedId: linkId
    })

  } catch (error: any) {
    console.error('🗑️ API: Unexpected error in delete endpoint:', error)
    return NextResponse.json(
      {
        error: `Server error: ${error?.message || 'Unknown error'}`,
        details: error?.toString()
      },
      { status: 500 }
    )
  }
}