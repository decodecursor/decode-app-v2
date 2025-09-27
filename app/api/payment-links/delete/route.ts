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

    // Check for COMPLETED/PAID transactions (these prevent deletion)
    const { data: completedTransactions, error: txError } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('payment_link_id', linkId)
      .in('status', ['completed', 'paid', 'success'])
      .limit(1)

    if (txError) {
      console.error('🗑️ API: Error checking for completed transactions:', txError)
    }

    if (!txError && completedTransactions && completedTransactions.length > 0) {
      console.warn('🗑️ API: Payment link has completed transactions, cannot delete')
      return NextResponse.json(
        {
          error: 'Cannot delete payment link with completed payments. Only unpaid links can be deleted.',
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

    // Clean up related records that can be safely deleted

    // 1. Delete analytics events for this payment link
    const { data: analyticsEvents, error: analyticsDeleteError } = await supabase
      .from('analytics_events')
      .delete()
      .eq('payment_link_id', linkId)
      .select('id')

    if (analyticsDeleteError) {
      console.error('🗑️ API: Error deleting analytics events:', analyticsDeleteError)
    } else {
      console.log('🗑️ API: Deleted analytics events:', analyticsEvents?.length || 0)
    }

    // 2. Get ALL transactions (except completed ones) that we need to delete
    // This includes: pending, failed, cancelled, expired, processing, error, etc.
    const { data: transactionsToDelete, error: transactionFetchError } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('payment_link_id', linkId)
      .not('status', 'in', '(completed,paid,success)')

    if (transactionFetchError) {
      console.error('🗑️ API: Error fetching non-completed transactions:', transactionFetchError)
    } else {
      console.log('🗑️ API: Found non-completed transactions to delete:', transactionsToDelete?.length || 0,
                 'with statuses:', transactionsToDelete?.map(t => t.status))
    }

    // 3. Delete transaction-related records that prevent transaction deletion
    if (transactionsToDelete && transactionsToDelete.length > 0) {
      const transactionIds = transactionsToDelete.map(t => t.id)
      console.log('🗑️ API: Found transactions to delete:', transactionIds.length, 'IDs:', transactionIds)

      // Delete from transfers table
      const { data: deletedTransfers, error: transfersDeleteError } = await supabase
        .from('transfers')
        .delete()
        .in('payment_id', transactionIds)
        .select('id')

      if (transfersDeleteError) {
        console.error('🗑️ API: Error deleting transfers:', transfersDeleteError)
        // Continue anyway - transfers might not exist
      } else {
        console.log('🗑️ API: Deleted transfers:', deletedTransfers?.length || 0)
      }

      // Delete from geographic_analytics table
      const { data: deletedGeoAnalytics, error: geoAnalyticsDeleteError } = await supabase
        .from('geographic_analytics')
        .delete()
        .in('transaction_id', transactionIds)
        .select('id')

      if (geoAnalyticsDeleteError) {
        console.error('🗑️ API: Error deleting geographic analytics:', geoAnalyticsDeleteError)
        // Continue anyway - analytics might not exist
      } else {
        console.log('🗑️ API: Deleted geographic analytics:', deletedGeoAnalytics?.length || 0)
      }

      // Delete from payment_analytics table
      const { data: deletedPaymentAnalytics, error: paymentAnalyticsDeleteError } = await supabase
        .from('payment_analytics')
        .delete()
        .in('transaction_id', transactionIds)
        .select('id')

      if (paymentAnalyticsDeleteError) {
        console.error('🗑️ API: Error deleting payment analytics:', paymentAnalyticsDeleteError)
        // Continue anyway - analytics might not exist
      } else {
        console.log('🗑️ API: Deleted payment analytics:', deletedPaymentAnalytics?.length || 0)
      }

      // Delete from payment_split_transactions table
      const { data: deletedSplitTransactions, error: splitTransactionsDeleteError } = await supabase
        .from('payment_split_transactions')
        .delete()
        .in('transaction_id', transactionIds)
        .select('id')

      if (splitTransactionsDeleteError) {
        console.error('🗑️ API: Error deleting payment split transactions:', splitTransactionsDeleteError)
        // Continue anyway - split transactions might not exist
      } else {
        console.log('🗑️ API: Deleted payment split transactions:', deletedSplitTransactions?.length || 0)
      }

      // Additional cleanup - Delete any other possible related records
      // Delete from any audit logs or history tables that might reference transactions
      const { error: auditDeleteError } = await supabase
        .from('audit_logs')
        .delete()
        .in('entity_id', transactionIds)
        .eq('entity_type', 'transaction')

      if (auditDeleteError) {
        // Ignore if table doesn't exist
        console.log('🗑️ API: No audit logs to delete or table does not exist')
      }
    }

    // 4. Now delete ALL non-completed transactions
    const { data: deletedTransactions, error: transactionDeleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('payment_link_id', linkId)
      .not('status', 'in', '(completed,paid,success)')
      .select('id, status')

    if (transactionDeleteError) {
      console.error('🗑️ API: Error deleting non-completed transactions:', transactionDeleteError)
      console.error('🗑️ API: Transaction delete error details:', {
        message: transactionDeleteError.message,
        details: transactionDeleteError.details,
        hint: transactionDeleteError.hint,
        code: transactionDeleteError.code
      })

      // If transaction deletion failed, try a more aggressive approach
      console.log('🗑️ API: Attempting fallback deletion method...')

      // Try to delete transactions one by one to identify problematic ones
      if (transactionsToDelete && transactionsToDelete.length > 0) {
        for (const transaction of transactionsToDelete) {
          const { error: singleDeleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transaction.id)

          if (singleDeleteError) {
            console.error(`🗑️ API: Failed to delete transaction ${transaction.id}:`, singleDeleteError.message)
          } else {
            console.log(`🗑️ API: Successfully deleted transaction ${transaction.id}`)
          }
        }
      }
    } else {
      console.log('🗑️ API: Successfully deleted non-completed transactions:', deletedTransactions?.length || 0,
                 'with statuses:', deletedTransactions?.map(t => t.status))
    }

    // 5. Check for payment split recipients (should cascade delete, but let's log)
    const { data: splitRecipients } = await supabase
      .from('payment_split_recipients')
      .select('id')
      .eq('payment_link_id', linkId)

    console.log('🗑️ API: Payment split recipients found:', splitRecipients?.length || 0)

    // 6. Check for email logs (should SET NULL, but let's log)
    const { data: emailLogs } = await supabase
      .from('email_logs')
      .select('id')
      .eq('payment_link_id', linkId)

    console.log('🗑️ API: Email logs found:', emailLogs?.length || 0)

    // 7. Check for wallet transactions (should SET NULL, but let's log)
    const { data: walletTransactions } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('payment_link_id', linkId)

    console.log('🗑️ API: Wallet transactions found:', walletTransactions?.length || 0)

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
        // Foreign key constraint violation - try to identify which table is causing the issue
        console.error('🗑️ API: Foreign key constraint violation. Checking for remaining related records...')

        const relatedRecordsCheck = await Promise.all([
          supabase.from('transactions').select('id, status').eq('payment_link_id', linkId),
          supabase.from('analytics_events').select('id').eq('payment_link_id', linkId),
          supabase.from('payment_split_recipients').select('id').eq('payment_link_id', linkId),
          supabase.from('email_logs').select('id').eq('payment_link_id', linkId),
          supabase.from('wallet_transactions').select('id').eq('payment_link_id', linkId)
        ])

        const [remainingTransactions, remainingAnalytics, remainingSplits, remainingEmails, remainingWallet] = relatedRecordsCheck

        // Check for payment_split_transactions if there are transactions
        let remainingSplitTransactions = { data: [] }
        if (remainingTransactions.data && remainingTransactions.data.length > 0) {
          const transactionIds = remainingTransactions.data.map(t => t.id)
          remainingSplitTransactions = await supabase
            .from('payment_split_transactions')
            .select('id')
            .in('transaction_id', transactionIds)
        }

        console.error('🗑️ API: Remaining related records:', {
          transactions: remainingTransactions.data?.length || 0,
          analytics_events: remainingAnalytics.data?.length || 0,
          payment_split_recipients: remainingSplits.data?.length || 0,
          email_logs: remainingEmails.data?.length || 0,
          wallet_transactions: remainingWallet.data?.length || 0,
          payment_split_transactions: remainingSplitTransactions.data?.length || 0
        })

        let detailedError = 'Cannot delete payment link. '

        if (remainingTransactions.data && remainingTransactions.data.length > 0) {
          const statuses = remainingTransactions.data.map(t => t.status)
          const hasCompleted = statuses.some(s => ['completed', 'paid', 'success'].includes(s))

          if (hasCompleted) {
            detailedError += 'This link has completed payments and cannot be deleted.'
          } else {
            detailedError += `Unable to clean up ${remainingTransactions.data.length} pending transaction(s). Please try again or contact support.`
          }
        } else {
          detailedError += 'There are related records preventing deletion. Please try again.'
        }

        return NextResponse.json(
          {
            error: detailedError,
            code: deleteError.code,
            relatedRecords: {
              transactions: remainingTransactions.data?.length || 0,
              analytics_events: remainingAnalytics.data?.length || 0,
              payment_split_recipients: remainingSplits.data?.length || 0,
              email_logs: remainingEmails.data?.length || 0,
              wallet_transactions: remainingWallet.data?.length || 0,
              payment_split_transactions: remainingSplitTransactions.data?.length || 0
            }
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