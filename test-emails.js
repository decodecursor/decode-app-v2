// Test script to trigger all three email notifications
const { emailService } = require('./lib/email-service.ts')

async function testAllEmails() {
  console.log('🧪 Starting email notification tests...')

  try {
    // 1. Test Registration Notification
    console.log('🧪 Testing registration notification...')
    const registrationResult = await emailService.sendAdminUserRegistrationNotification({
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
    console.log('✅ Registration notification:', registrationResult.success ? 'SUCCESS' : 'FAILED')
    if (!registrationResult.success) console.log('Error:', registrationResult.error)

    // 2. Test Payment Success Notification
    console.log('🧪 Testing payment notification...')
    const paymentResult = await emailService.sendAdminPaymentNotification({
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
    console.log('✅ Payment notification:', paymentResult.success ? 'SUCCESS' : 'FAILED')
    if (!paymentResult.success) console.log('Error:', paymentResult.error)

    // 3. Test Payout Request Notification
    console.log('🧪 Testing payout notification...')
    const payoutResult = await emailService.sendAdminPayoutRequestNotification({
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
      last_payout_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_payout_amount: 1500,
      request_date: new Date().toISOString()
    })
    console.log('✅ Payout notification:', payoutResult.success ? 'SUCCESS' : 'FAILED')
    if (!payoutResult.success) console.log('Error:', payoutResult.error)

    console.log('🧪 All email tests completed!')
    console.log('📧 Check sebastian@welovedecode.com for the three test emails')

  } catch (error) {
    console.error('🚨 Error during email tests:', error)
  }
}

testAllEmails()