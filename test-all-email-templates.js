// Comprehensive test for all email templates
// Run with: node test-all-email-templates.js

require('dotenv').config({ path: '.env.local' });

async function testAllEmailTemplates() {
  console.log('🧪 COMPREHENSIVE EMAIL TEMPLATE TEST');
  console.log('=====================================\n');

  const { emailService } = require('./lib/email-service.ts');

  const results = {
    adminNotifications: {},
    customerEmails: {},
    creatorEmails: {}
  };

  // ============================================
  // ADMIN NOTIFICATIONS (to sebastian@welovedecode.com)
  // ============================================

  console.log('📧 TESTING ADMIN NOTIFICATIONS\n');

  // 1. User Registration
  console.log('1️⃣ Testing Admin User Registration Email...');
  try {
    results.adminNotifications.registration = await emailService.sendAdminUserRegistrationNotification({
      id: 'test-' + Date.now(),
      email: 'newuser@beautysalon.com',
      user_name: 'Jane Smith',
      role: 'Staff',
      company_name: 'Beauty Salon Dubai',
      branch_name: 'Marina Mall',
      approval_status: 'pending',
      created_at: new Date().toISOString()
    });
    console.log('   ✅ Registration email:', results.adminNotifications.registration.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Registration email FAILED:', error.message);
    results.adminNotifications.registration = { success: false, error: error.message };
  }

  // 2. Payment Notification
  console.log('2️⃣ Testing Admin Payment Notification Email...');
  try {
    results.adminNotifications.payment = await emailService.sendAdminPaymentNotification({
      payment_link_id: 'pay_' + Date.now(),
      transaction_id: 'txn_' + Date.now(),
      service_amount_aed: 350,
      decode_amount_aed: 50,
      total_amount_aed: 400,
      platform_fee: 40,
      company_name: 'Luxury Spa',
      staff_name: 'Emma Wilson',
      branch_name: 'JBR Branch',
      client_name: 'Sarah Ahmed',
      client_email: 'sarah@example.com',
      client_phone: '+971501234567',
      service_name: 'Full Body Massage',
      service_description: '90 minute relaxation massage',
      payment_method: 'Card',
      payment_processor: 'stripe',
      processor_transaction_id: 'pi_test123',
      completed_at: new Date().toISOString()
    });
    console.log('   ✅ Payment notification:', results.adminNotifications.payment.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Payment notification FAILED:', error.message);
    results.adminNotifications.payment = { success: false, error: error.message };
  }

  // 3. Payout Request
  console.log('3️⃣ Testing Admin Payout Request Email...');
  try {
    results.adminNotifications.payout = await emailService.sendAdminPayoutRequestNotification({
      payout_request_id: 'payout_' + Date.now(),
      user_name: 'Michael Brown',
      user_email: 'michael@beautysalon.com',
      user_role: 'Admin',
      user_id: 'user_123',
      company_name: 'Elite Beauty Center',
      branch_name: 'Downtown Dubai',
      amount: 5000,
      total_earnings: 15000,
      available_balance: 5000,
      previous_payouts_count: 2,
      preferred_payout_method: 'bank_account',
      beneficiary_name: 'Michael Brown',
      bank_name: 'Emirates NBD',
      account_type: 'Savings',
      iban_number: 'AE123456789012345678901234',
      last_payout_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_payout_amount: 3500,
      request_date: new Date().toISOString()
    });
    console.log('   ✅ Payout request:', results.adminNotifications.payout.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Payout request FAILED:', error.message);
    results.adminNotifications.payout = { success: false, error: error.message };
  }

  // ============================================
  // CUSTOMER PAYMENT EMAILS
  // ============================================

  console.log('\n📧 TESTING CUSTOMER PAYMENT EMAILS\n');

  // 4. Payment Confirmation
  console.log('4️⃣ Testing Customer Payment Confirmation Email...');
  try {
    results.customerEmails.confirmation = await emailService.sendPaymentConfirmation({
      buyerEmail: 'customer@example.com',
      buyerName: 'John Doe',
      transactionId: 'txn_confirm_' + Date.now(),
      amount: 250,
      currency: 'AED',
      serviceTitle: 'Premium Hair Treatment',
      serviceDescription: 'Keratin treatment and styling',
      creatorName: 'Beauty Studio Pro',
      creatorEmail: 'studio@example.com',
      paymentMethod: 'Credit Card',
      transactionDate: new Date().toISOString(),
      receiptUrl: 'https://app.welovedecode.com/receipt/123'
    });
    console.log('   ✅ Payment confirmation:', results.customerEmails.confirmation.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Payment confirmation FAILED:', error.message);
    results.customerEmails.confirmation = { success: false, error: error.message };
  }

  // 5. Payment Failure
  console.log('5️⃣ Testing Customer Payment Failure Email...');
  try {
    results.customerEmails.failure = await emailService.sendPaymentFailure({
      buyerEmail: 'customer@example.com',
      buyerName: 'Jane Doe',
      transactionId: 'txn_fail_' + Date.now(),
      amount: 150,
      currency: 'AED',
      serviceTitle: 'Nail Art Session',
      failureReason: 'Card declined by issuer',
      retryUrl: 'https://app.welovedecode.com/pay/retry123',
      supportEmail: 'support@welovedecode.com',
      failureDate: new Date().toISOString()
    });
    console.log('   ✅ Payment failure:', results.customerEmails.failure.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Payment failure FAILED:', error.message);
    results.customerEmails.failure = { success: false, error: error.message };
  }

  // 6. Payment Receipt
  console.log('6️⃣ Testing Customer Payment Receipt Email...');
  try {
    results.customerEmails.receipt = await emailService.sendPaymentReceipt({
      buyerEmail: 'customer@example.com',
      buyerName: 'Alice Johnson',
      transactionId: 'txn_receipt_' + Date.now(),
      amount: 300,
      currency: 'AED',
      serviceTitle: 'Spa Package',
      serviceDescription: 'Full spa treatment package',
      creatorName: 'Luxury Spa Dubai',
      creatorBusinessInfo: {
        name: 'Luxury Spa LLC',
        address: 'Dubai Marina, Dubai, UAE',
        taxId: 'TRN123456789012345'
      },
      paymentMethod: 'Apple Pay',
      transactionDate: new Date().toISOString(),
      fees: {
        processing: 10,
        platform: 30
      },
      receiptNumber: 'RCP-2024-' + Date.now()
    });
    console.log('   ✅ Payment receipt:', results.customerEmails.receipt.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Payment receipt FAILED:', error.message);
    results.customerEmails.receipt = { success: false, error: error.message };
  }

  // ============================================
  // CREATOR NOTIFICATIONS
  // ============================================

  console.log('\n📧 TESTING CREATOR NOTIFICATION EMAILS\n');

  // 7. Creator Payment Notification
  console.log('7️⃣ Testing Creator Payment Notification Email...');
  try {
    results.creatorEmails.payment = await emailService.sendCreatorPaymentNotification({
      creatorEmail: 'creator@beautysalon.com',
      creatorName: 'Beauty Professional',
      transactionId: 'txn_creator_' + Date.now(),
      amount: 500,
      currency: 'AED',
      serviceTitle: 'Premium Beauty Service',
      buyerEmail: 'buyer@example.com',
      transactionDate: new Date().toISOString()
    });
    console.log('   ✅ Creator notification:', results.creatorEmails.payment.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ Creator notification FAILED:', error.message);
    results.creatorEmails.payment = { success: false, error: error.message };
  }

  // 8. User Invitation
  console.log('8️⃣ Testing User Invitation Email...');
  try {
    results.creatorEmails.invitation = await emailService.sendUserInvitation({
      recipientEmail: 'newstaff@example.com',
      recipientName: 'New Staff Member',
      inviterName: 'Admin User',
      companyName: 'Premium Beauty Center',
      role: 'Staff',
      signupUrl: 'https://app.welovedecode.com/register?invite=abc123',
      inviteDate: new Date().toISOString()
    });
    console.log('   ✅ User invitation:', results.creatorEmails.invitation.success ? 'SENT' : 'FAILED');
  } catch (error) {
    console.log('   ❌ User invitation FAILED:', error.message);
    results.creatorEmails.invitation = { success: false, error: error.message };
  }

  // ============================================
  // RESULTS SUMMARY
  // ============================================

  console.log('\n=====================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=====================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Count results
  for (const category in results) {
    console.log(`\n📁 ${category.toUpperCase()}:`);
    for (const test in results[category]) {
      totalTests++;
      const result = results[category][test];
      if (result.success) {
        passedTests++;
        console.log(`   ✅ ${test}: PASSED (ID: ${result.messageId})`);
      } else {
        failedTests++;
        console.log(`   ❌ ${test}: FAILED (${result.error})`);
      }
    }
  }

  console.log('\n=====================================');
  console.log(`TOTAL: ${totalTests} tests`);
  console.log(`✅ PASSED: ${passedTests}`);
  console.log(`❌ FAILED: ${failedTests}`);
  console.log(`SUCCESS RATE: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
  console.log('=====================================');

  // Check environment
  console.log('\n🔧 ENVIRONMENT CHECK:');
  console.log(`EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER || 'NOT SET'}`);
  console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'SET (' + process.env.RESEND_API_KEY.substring(0, 10) + '...)' : 'NOT SET'}`);
  console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM || 'NOT SET'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);

  return results;
}

// Run the test
testAllEmailTemplates().then(() => {
  console.log('\n✅ All email template tests completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});