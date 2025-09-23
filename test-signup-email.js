#!/usr/bin/env node

/**
 * Test script to verify admin email notifications are sent during user signup
 */

require('dotenv').config({ path: '.env.local' });

async function testSignupEmailNotification() {
  console.log('🧪 Testing signup email notification...');

  // Test the email service directly first to ensure it's working
  console.log('\n1. Testing email service directly...');

  try {
    const { emailService } = require('./lib/email-service.ts');

    const testResult = await emailService.sendAdminUserRegistrationNotification({
      id: `test-signup-${Date.now()}`,
      email: 'test.signup@example.com',
      user_name: 'Test Signup User',
      role: 'User',
      company_name: 'Not specified',
      branch_name: 'Not specified',
      approval_status: 'pending',
      created_at: new Date().toISOString()
    });

    console.log('✅ Direct email test result:', testResult.success ? 'SUCCESS' : 'FAILED');
    if (!testResult.success) {
      console.log('❌ Email error:', testResult.error);
      return;
    }

  } catch (emailError) {
    console.error('❌ Direct email test failed:', emailError);
    return;
  }

  // Now test the actual signup endpoint
  console.log('\n2. Testing signup endpoint with email notification...');

  const testEmail = `test-signup-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  try {
    const signupResponse = await fetch('http://localhost:3001/api/auth/proxy-signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    const signupResult = await signupResponse.json();

    console.log('📝 Signup response status:', signupResponse.status);
    console.log('📝 Signup result:', {
      success: signupResult.success,
      hasUser: !!signupResult.user,
      userEmail: signupResult.user?.email,
      error: signupResult.error
    });

    if (signupResult.success) {
      console.log('✅ Signup successful - admin email should have been sent to sebastian@welovedecode.com');
      console.log('📧 Check the console logs above for email sending confirmation');
    } else {
      console.log('❌ Signup failed:', signupResult.error);
    }

  } catch (fetchError) {
    console.error('❌ Signup endpoint test failed:', fetchError.message);
    console.log('💡 Make sure the dev server is running on port 3001');
  }

  console.log('\n🧪 Test completed!');
  console.log('📧 If successful, sebastian@welovedecode.com should receive notification emails');
}

// Run the test
testSignupEmailNotification()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });