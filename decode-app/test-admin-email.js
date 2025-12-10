// Test script to verify admin registration email is working
// Run with: node test-admin-email.js

const { emailService } = require('./lib/email-service.ts')

async function testAdminEmail() {
  console.log('🧪 Testing Admin Registration Email...')
  console.log('================================================')

  // Test data
  const testUserData = {
    id: 'test-' + Date.now(),
    email: 'testuser@example.com',
    user_name: 'Test User ' + new Date().toLocaleTimeString(),
    role: 'Staff',
    company_name: 'Test Company',
    branch_name: 'Main Branch',
    approval_status: 'pending',
    created_at: new Date().toISOString()
  }

  console.log('📝 Test user data:', testUserData)
  console.log('\n📧 Sending email to: sebastian@welovedecode.com')
  console.log('================================================\n')

  try {
    const result = await emailService.sendAdminUserRegistrationNotification(testUserData)

    console.log('\n🎯 RESULT:')
    console.log('================================================')

    if (result.success) {
      console.log('✅ SUCCESS! Email sent successfully')
      console.log('📧 Message ID:', result.messageId)
      console.log('🔧 Provider:', result.provider)
    } else {
      console.log('❌ FAILED! Email not sent')
      console.log('🔴 Error:', result.error)
      console.log('🔧 Provider:', result.provider)
    }
  } catch (error) {
    console.log('\n💥 EXCEPTION CAUGHT:')
    console.log('================================================')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
  }

  console.log('\n================================================')
  console.log('Test completed at:', new Date().toLocaleString())
}

// Run the test
testAdminEmail()