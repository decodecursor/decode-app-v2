import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email-service'

export async function GET(request: NextRequest) {
  console.log('🧪 [TEST-EMAILS] Starting email notification tests...')

  const results = {
    registration: null as any,
    payment: null as any,
    payout: null as any
  }

  try {
    // 1. Test Registration Notification
    console.log('🧪 [TEST-EMAILS] Testing registration notification...')
    results.registration = await emailService.sendAdminUserRegistrationNotification({
      id: 'test-user-123',
      email: 'john.doe@beautystudio.com',
      user_name: 'John Doe',
      role: 'Admin',
      company_name: 'Beauty Studio Dubai',
      branch_name: 'Downtown Branch',
      approval_status: 'pending',
      invited_by: 'system@welovedecode.com',
      created_at: new Date().toISOString()
    })
    console.log('✅ Registration notification result:', results.registration.success ? 'SUCCESS' : 'FAILED')

    // 2. Test Payment Success Notification
    console.log('🧪 [TEST-EMAILS] Testing payment notification...')
    results.payment = await emailService.sendAdminPaymentNotification({
      payment_link_id: 'pay_link_456',
      transaction_id: 'txn_789',
      service_amount_aed: 450,
      total_amount_aed: 500,
      platform_fee: 50,
      company_name: 'Beauty Studio Dubai',
      staff_name: 'Sarah Johnson',
      branch_name: 'Downtown Branch',
      client_name: 'Maria Al Mahmoud',
      client_email: 'maria@example.com',
      client_phone: '+971501234567',
      service_name: 'Premium Hair Treatment & Styling',
      service_description: 'Complete hair treatment package including wash, cut, color, and styling',
      payment_method: 'Credit Card',
      payment_processor: 'stripe',
      processor_transaction_id: 'pi_1234567890',
      completed_at: new Date().toISOString()
    })
    console.log('✅ Payment notification result:', results.payment.success ? 'SUCCESS' : 'FAILED')

    // 3. Test Payout Request Notification
    console.log('🧪 [TEST-EMAILS] Testing payout notification...')
    results.payout = await emailService.sendAdminPayoutRequestNotification({
      payout_request_id: 'tr_payout_123',
      user_name: 'Sarah Johnson',
      user_email: 'sarah@beautystudio.com',
      user_role: 'Admin',
      user_id: 'user_456',
      company_name: 'Beauty Studio Dubai',
      branch_name: 'Downtown Branch',
      amount: 2000,
      total_earnings: 5500,
      available_balance: 2000,
      previous_payouts_count: 3,
      account_holder_name: 'Sarah Johnson',
      bank_name: 'Emirates NBD',
      account_type: 'Business Checking',
      account_last4: '1234',
      stripe_connect_account_id: 'acct_1234567890',
      last_payout_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      last_payout_amount: 1500,
      request_date: new Date().toISOString()
    })
    console.log('✅ Payout notification result:', results.payout.success ? 'SUCCESS' : 'FAILED')

    console.log('🧪 [TEST-EMAILS] All email tests completed!')

    return NextResponse.json({
      success: true,
      message: 'All email notifications have been triggered',
      results: {
        registration: {
          success: results.registration.success,
          messageId: results.registration.messageId,
          error: results.registration.error
        },
        payment: {
          success: results.payment.success,
          messageId: results.payment.messageId,
          error: results.payment.error
        },
        payout: {
          success: results.payout.success,
          messageId: results.payout.messageId,
          error: results.payout.error
        }
      },
      note: 'Check sebastian@welovedecode.com for the three test emails',
      emails_sent_to: 'sebastian@welovedecode.com',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('🚨 [TEST-EMAILS] Error during email tests:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to send test emails',
      details: error instanceof Error ? error.message : 'Unknown error',
      results,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also support POST method for testing
export async function POST(request: NextRequest) {
  return GET(request)
}