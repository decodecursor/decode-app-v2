#!/usr/bin/env node

/**
 * Test Real Email to Sebastian
 * 
 * Sends actual test emails to sebastian@welovedecode.com using Resend
 */

// Environment configuration
const RESEND_API_KEY = 're_3yxEgGkq_KgFdwuqCrNVbjJ54mxazBvVs'
const TEST_EMAIL = 'sebastian@welovedecode.com'

async function sendTestEmail(testType = 'basic') {
  console.log(`🧪 Sending ${testType} test email to ${TEST_EMAIL}...`)
  
  let subject, html, text
  
  if (testType === 'basic') {
    subject = 'DECODE Email Service Test - ' + new Date().toLocaleString()
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff1744 0%, #e91e63 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">DECODE</h1>
          <h2 style="margin: 10px 0 0 0; font-weight: 400;">Email Service Test</h2>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
            <h3 style="color: #333; margin: 0;">Email Service Working!</h3>
          </div>
          <p>Hi Sebastian,</p>
          <p>This is a test email from the DECODE platform to verify that our Resend email integration is working correctly.</p>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #333;">Test Details:</h4>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Provider:</strong> Resend</li>
              <li><strong>API Key:</strong> ${RESEND_API_KEY.substring(0, 8)}...</li>
              <li><strong>To:</strong> ${TEST_EMAIL}</li>
              <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          <p>If you received this email, the DECODE email notification system is ready for production! 🎉</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 14px;">
            <p>This email was sent by the DECODE Beauty Platform email service.</p>
          </div>
        </div>
      </div>
    `
    text = `
DECODE - Email Service Test

✅ Email Service Working!

Hi Sebastian,

This is a test email from the DECODE platform to verify that our Resend email integration is working correctly.

Test Details:
- Provider: Resend
- API Key: ${RESEND_API_KEY.substring(0, 8)}...
- To: ${TEST_EMAIL}
- Test Time: ${new Date().toLocaleString()}

If you received this email, the DECODE email notification system is ready for production! 🎉

---
This email was sent by the DECODE Beauty Platform email service.
    `.trim()
  
  } else if (testType === 'payment_confirmation') {
    subject = 'Payment Confirmed - Test Beauty Service'
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff1744 0%, #e91e63 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">DECODE</h1>
          <h2 style="margin: 10px 0 0 0; font-weight: 400;">Payment Confirmed!</h2>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
            <h3 style="color: #333; margin: 0;">Thank you, Sebastian!</h3>
            <div style="font-size: 28px; font-weight: bold; color: #4CAF50; margin: 20px 0;">$99.99 USD</div>
            <p style="color: #666;">Your payment has been successfully processed.</p>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
            <h4 style="margin: 0 0 15px 0; color: #333;">Payment Details</h4>
            <table style="border-collapse: collapse; max-width: 400px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 120px; vertical-align: top;">
                  <strong>Service:</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top;">
                  Test Beauty Consultation
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 120px; vertical-align: top;">
                  <strong>Provider:</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top;">
                  DECODE Beauty Expert
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 120px; vertical-align: top;">
                  <strong>Date:</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top;">
                  ${new Date().toLocaleDateString()}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; width: 120px; vertical-align: top;">
                  <strong>Transaction ID:</strong>
                </td>
                <td style="padding: 8px 0; vertical-align: top; font-family: monospace; font-size: 14px;">
                  test_${Date.now()}
                </td>
              </tr>
            </table>
          </div>
          <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>What's next?</strong><br>
            You will receive your service details from DECODE Beauty Expert soon. They will contact you directly to coordinate the service delivery.</p>
          </div>
        </div>
      </div>
    `
    text = `
DECODE - Payment Confirmed!

Thank you, Sebastian!

PAYMENT AMOUNT: $99.99 USD

Your payment has been successfully processed.

PAYMENT DETAILS
---------------
Service: Test Beauty Consultation
Provider: DECODE Beauty Expert
Date: ${new Date().toLocaleDateString()}
Transaction ID: test_${Date.now()}

WHAT'S NEXT?
You will receive your service details from DECODE Beauty Expert soon. 
They will contact you directly to coordinate the service delivery.

---
DECODE Beauty Platform
    `.trim()
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DECODE Beauty <onboarding@resend.dev>', // Using Resend's verified domain
        to: [TEST_EMAIL],
        subject: subject,
        html: html,
        text: text
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Email sent successfully!')
      console.log('📧 Email ID:', result.id)
      console.log('📧 To:', TEST_EMAIL)
      console.log('📧 Subject:', subject)
      return { success: true, id: result.id }
    } else {
      console.error('❌ Email sending failed:')
      console.error('Status:', response.status)
      console.error('Error:', result)
      return { success: false, error: result }
    }

  } catch (error) {
    console.error('❌ Network error:', error.message)
    return { success: false, error: error.message }
  }
}

async function runEmailTests() {
  console.log('🚀 DECODE Real Email Test for Sebastian')
  console.log('=======================================\n')
  
  console.log(`📧 Target email: ${TEST_EMAIL}`)
  console.log(`🔑 Using API key: ${RESEND_API_KEY.substring(0, 8)}...\n`)
  
  // Test 1: Basic email
  console.log('🧪 Test 1: Basic email test')
  const test1 = await sendTestEmail('basic')
  
  if (test1.success) {
    console.log('✅ Basic email test passed\n')
    
    // Wait a moment between emails
    console.log('⏳ Waiting 3 seconds before next test...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Test 2: Payment confirmation email
    console.log('🧪 Test 2: Payment confirmation email')
    const test2 = await sendTestEmail('payment_confirmation')
    
    if (test2.success) {
      console.log('✅ Payment confirmation test passed\n')
      
      console.log('🎉 All email tests completed successfully!')
      console.log('\n📬 Check your email inbox at:', TEST_EMAIL)
      console.log('\n📋 Next Steps:')
      console.log('1. ✅ Verify emails arrived in your inbox')
      console.log('2. ✅ Check email formatting and content')
      console.log('3. ✅ Email service is ready for webhook integration')
      console.log('4. 🔜 Consider setting up custom domain verification')
      
    } else {
      console.log('❌ Payment confirmation test failed')
    }
  } else {
    console.log('❌ Basic email test failed')
  }
}

// Run the tests
runEmailTests().catch(error => {
  console.error('\n💥 Email test failed:', error.message)
  process.exit(1)
})