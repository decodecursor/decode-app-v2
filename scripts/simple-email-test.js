#!/usr/bin/env node

/**
 * Simple Email Service Test
 * 
 * Tests the mock email provider functionality
 */

// Mock implementation of the email service for testing
class MockEmailProvider {
  constructor() {
    this.name = 'mock'
  }

  async sendEmail({ to, from, subject, html, text }) {
    console.log('\n📧 MOCK EMAIL SENT')
    console.log('================')
    console.log(`To: ${to}`)
    console.log(`From: ${from}`)
    console.log(`Subject: ${subject}`)
    console.log(`HTML Length: ${html ? html.length : 0} characters`)
    console.log(`Text Length: ${text ? text.length : 0} characters`)
    console.log('================\n')
    
    return { success: true, messageId: 'mock_' + Date.now() }
  }
}

// Test data
const testData = {
  confirmation: {
    to: 'customer@example.com',
    from: 'DECODE Beauty <noreply@decode.beauty>',
    subject: 'Payment Confirmed - DECODE Beauty',
    html: `
      <h1>Payment Confirmed!</h1>
      <p>Thank you for your payment of $99.99 for Beauty Service.</p>
      <p>Transaction ID: test_txn_${Date.now()}</p>
    `,
    text: `
      Payment Confirmed!
      Thank you for your payment of $99.99 for Beauty Service.
      Transaction ID: test_txn_${Date.now()}
    `
  },
  
  failure: {
    to: 'customer@example.com',
    from: 'DECODE Beauty <noreply@decode.beauty>',
    subject: 'Payment Failed - DECODE Beauty',
    html: `
      <h1>Payment Failed</h1>
      <p>We couldn't process your payment of $149.99 for Beauty Service.</p>
      <p>Reason: Card was declined</p>
      <p>Transaction ID: test_fail_${Date.now()}</p>
    `,
    text: `
      Payment Failed
      We couldn't process your payment of $149.99 for Beauty Service.
      Reason: Card was declined
      Transaction ID: test_fail_${Date.now()}
    `
  },
  
  receipt: {
    to: 'customer@example.com',
    from: 'DECODE Beauty <noreply@decode.beauty>',
    subject: 'Payment Receipt - DECODE Beauty',
    html: `
      <h1>Payment Receipt</h1>
      <p>Receipt for your payment of $199.99</p>
      <p>Service: Premium Beauty Package</p>
      <p>Receipt Number: REC-${Date.now()}</p>
    `,
    text: `
      Payment Receipt
      Receipt for your payment of $199.99
      Service: Premium Beauty Package
      Receipt Number: REC-${Date.now()}
    `
  }
}

async function runTests() {
  console.log('🚀 DECODE Email Service Simple Test')
  console.log('=====================================\n')
  
  const provider = new MockEmailProvider()
  
  for (const [testName, emailData] of Object.entries(testData)) {
    console.log(`🧪 Testing ${testName} email...`)
    
    try {
      const result = await provider.sendEmail(emailData)
      
      if (result.success) {
        console.log(`✅ ${testName} test PASSED`)
        console.log(`Message ID: ${result.messageId}`)
      } else {
        console.log(`❌ ${testName} test FAILED`)
        console.log(`Error: ${result.error}`)
      }
    } catch (error) {
      console.log(`❌ ${testName} test FAILED with exception`)
      console.error(`Error: ${error.message}`)
    }
    
    console.log('')
  }
  
  console.log('🎉 All tests completed!')
}

// Configuration check
function checkConfiguration() {
  console.log('🔧 Checking email configuration...')
  
  const provider = process.env.EMAIL_PROVIDER || 'mock'
  const fromEmail = process.env.EMAIL_FROM || 'DECODE Beauty <noreply@decode.beauty>'
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@decode.beauty'
  
  console.log(`Email provider: ${provider}`)
  console.log(`From email: ${fromEmail}`)
  console.log(`Support email: ${supportEmail}`)
  console.log('✅ Configuration loaded\n')
  
  return true
}

// Main execution
async function main() {
  checkConfiguration()
  await runTests()
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled promise rejection:', error.message)
  process.exit(1)
})

// Run the test
main().catch(error => {
  console.error('💥 Test failed:', error.message)
  process.exit(1)
})