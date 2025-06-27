#!/usr/bin/env node

/**
 * Real Email Delivery Test
 * 
 * Tests actual email delivery using Resend API
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

// Simple test of Resend API
async function testResendDirectly() {
  console.log('🧪 Testing Resend API directly...')
  
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'DECODE Beauty <noreply@decode.beauty>'
  
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in environment')
    return false
  }
  
  console.log(`📧 Using API key: ${apiKey.substring(0, 8)}...`)
  console.log(`📧 From email: ${fromEmail}`)
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['test@example.com'], // This is a test email that won't actually be delivered
        subject: 'DECODE Test Email - ' + new Date().toISOString(),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff1744 0%, #e91e63 100%); color: white; padding: 30px; text-align: center;">
              <h1>DECODE</h1>
              <h2>Email Service Test</h2>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h3>✅ Real Email Delivery Working!</h3>
              <p>This is a test email sent from the DECODE platform using Resend.</p>
              <p><strong>Test Details:</strong></p>
              <ul>
                <li>Provider: Resend</li>
                <li>API Key: ${apiKey.substring(0, 8)}...</li>
                <li>From: ${fromEmail}</li>
                <li>Date: ${new Date().toLocaleString()}</li>
              </ul>
              <p>If you received this email, the email service is working correctly!</p>
            </div>
          </div>
        `,
        text: `
DECODE - Email Service Test

✅ Real Email Delivery Working!

This is a test email sent from the DECODE platform using Resend.

Test Details:
- Provider: Resend
- API Key: ${apiKey.substring(0, 8)}...
- From: ${fromEmail}
- Date: ${new Date().toLocaleString()}

If you received this email, the email service is working correctly!
        `.trim()
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Resend API test successful!')
      console.log('📧 Email ID:', result.id)
      console.log('📧 Response:', result)
      return true
    } else {
      console.error('❌ Resend API test failed:')
      console.error('Status:', response.status)
      console.error('Error:', result)
      return false
    }

  } catch (error) {
    console.error('❌ Resend API test error:', error.message)
    return false
  }
}

// Test configuration
function testConfiguration() {
  console.log('🔧 Testing email configuration...')
  
  const provider = process.env.EMAIL_PROVIDER
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM
  const supportEmail = process.env.SUPPORT_EMAIL
  
  console.log('Configuration:')
  console.log(`├── Provider: ${provider || 'NOT SET'}`)
  console.log(`├── Resend API Key: ${resendKey ? resendKey.substring(0, 8) + '...' : 'NOT SET'}`)
  console.log(`├── From Email: ${fromEmail || 'NOT SET'}`)
  console.log(`└── Support Email: ${supportEmail || 'NOT SET'}`)
  
  if (provider !== 'resend') {
    console.error('❌ EMAIL_PROVIDER should be "resend"')
    return false
  }
  
  if (!resendKey || !resendKey.startsWith('re_')) {
    console.error('❌ RESEND_API_KEY missing or invalid format')
    return false
  }
  
  if (!fromEmail) {
    console.error('❌ EMAIL_FROM not set')
    return false
  }
  
  console.log('✅ Configuration looks good!')
  return true
}

// Main test function
async function runTests() {
  console.log('🚀 DECODE Real Email Delivery Test')
  console.log('===================================\n')
  
  // Test configuration
  if (!testConfiguration()) {
    console.error('\n❌ Configuration test failed')
    process.exit(1)
  }
  
  console.log('')
  
  // Test Resend API directly
  const apiWorking = await testResendDirectly()
  
  if (apiWorking) {
    console.log('\n🎉 Email service is ready for production!')
    console.log('\n📋 Next Steps:')
    console.log('1. ✅ Resend API is working')
    console.log('2. ✅ Environment variables configured')
    console.log('3. ✅ Email service will now send real emails')
    console.log('4. 🔜 Test with webhook integration')
    console.log('5. 🔜 Verify domain authentication in Resend dashboard')
  } else {
    console.log('\n❌ Email service needs attention')
    console.log('\n🔧 Troubleshooting:')
    console.log('1. Check Resend API key is valid')
    console.log('2. Verify domain is authenticated in Resend')
    console.log('3. Check from email address is authorized')
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test failed:', error.message)
  process.exit(1)
})