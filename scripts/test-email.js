#!/usr/bin/env node

/**
 * Email Service Test Script
 * 
 * Tests email delivery with different providers and scenarios
 * Usage: node scripts/test-email.js [scenario]
 */

// Dynamic import for ES modules
let emailService

async function loadEmailService() {
  if (!emailService) {
    try {
      const module = await import('../lib/email-service.js')
      emailService = module.emailService
    } catch (error) {
      console.error('Failed to load email service:', error.message)
      console.log('Make sure the email service is properly built/compiled')
      process.exit(1)
    }
  }
  return emailService
}

// Test scenarios
const scenarios = {
  confirmation: async () => {
    console.log('🧪 Testing payment confirmation email...')
    
    const service = await loadEmailService()
    const result = await service.sendPaymentConfirmation({
      buyerEmail: 'test@example.com',
      transactionId: 'test_txn_' + Date.now(),
      amount: 99.99,
      currency: 'USD',
      serviceTitle: 'Test Beauty Service',
      creatorName: 'Test Creator',
      creatorEmail: 'creator@example.com',
      transactionDate: new Date().toISOString()
    })
    
    console.log('Result:', result)
    return result
  },

  failure: async () => {
    console.log('🧪 Testing payment failure email...')
    
    const service = await loadEmailService()
    const result = await service.sendPaymentFailure({
      buyerEmail: 'test@example.com',
      transactionId: 'test_fail_' + Date.now(),
      amount: 149.99,
      currency: 'USD',
      serviceTitle: 'Test Beauty Service',
      failureReason: 'Card was declined - insufficient funds',
      retryUrl: 'https://decode.beauty/pay/test123',
      supportEmail: 'support@decode.beauty',
      failureDate: new Date().toISOString()
    })
    
    console.log('Result:', result)
    return result
  },

  receipt: async () => {
    console.log('🧪 Testing payment receipt email...')
    
    const service = await loadEmailService()
    const result = await service.sendPaymentReceipt({
      buyerName: 'Test Customer',
      buyerEmail: 'test@example.com',
      transactionId: 'test_receipt_' + Date.now(),
      amount: 199.99,
      currency: 'USD',
      serviceTitle: 'Premium Beauty Package',
      serviceDescription: 'Complete beauty consultation and styling session',
      creatorName: 'Professional Stylist',
      creatorBusinessInfo: {
        name: 'Beauty Studio LLC',
        address: '123 Beauty Lane, Glamour City, GC 12345',
        website: 'https://beautystudio.example.com',
        taxId: 'TX-123456789'
      },
      paymentMethod: 'Credit Card',
      transactionDate: new Date().toISOString(),
      receiptNumber: 'REC-' + Date.now(),
      fees: {
        processing: 5.99,
        platform: 9.99
      }
    })
    
    console.log('Result:', result)
    return result
  },

  creatorNotification: async () => {
    console.log('🧪 Testing creator payment notification...')
    
    const service = await loadEmailService()
    const result = await service.sendCreatorPaymentNotification({
      creatorEmail: 'creator@example.com',
      creatorName: 'Test Creator',
      transactionId: 'test_creator_' + Date.now(),
      amount: 299.99,
      currency: 'USD',
      serviceTitle: 'Luxury Beauty Experience',
      buyerEmail: 'customer@example.com',
      transactionDate: new Date().toISOString()
    })
    
    console.log('Result:', result)
    return result
  },

  all: async () => {
    console.log('🧪 Running all email test scenarios...\n')
    
    const results = {}
    
    for (const [name, scenario] of Object.entries(scenarios)) {
      if (name === 'all') continue
      
      try {
        console.log(`\n--- Testing ${name} ---`)
        results[name] = await scenario()
        console.log(`✅ ${name} test completed`)
      } catch (error) {
        console.error(`❌ ${name} test failed:`, error.message)
        results[name] = { success: false, error: error.message }
      }
    }
    
    console.log('\n📊 Test Summary:')
    console.log('==================')
    
    for (const [name, result] of Object.entries(results)) {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${name}: ${result.success ? 'PASSED' : result.error}`)
    }
    
    return results
  }
}

// Configuration check
function checkConfiguration() {
  console.log('🔧 Checking email configuration...')
  
  const provider = process.env.EMAIL_PROVIDER
  const fromEmail = process.env.EMAIL_FROM
  
  console.log(`Email provider: ${provider || 'NOT SET'}`)
  console.log(`From email: ${fromEmail || 'NOT SET'}`)
  
  if (!provider) {
    console.error('❌ EMAIL_PROVIDER environment variable not set')
    return false
  }
  
  if (!fromEmail) {
    console.error('❌ EMAIL_FROM environment variable not set')
    return false
  }
  
  // Check provider-specific configuration
  switch (provider) {
    case 'resend':
      if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY environment variable not set')
        return false
      }
      console.log('✅ Resend configuration looks good')
      break
      
    case 'sendgrid':
      if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ SENDGRID_API_KEY environment variable not set')
        return false
      }
      console.log('✅ SendGrid configuration looks good')
      break
      
    case 'mock':
      console.log('✅ Mock provider configuration (no API key required)')
      break
      
    default:
      console.error(`❌ Unknown email provider: ${provider}`)
      return false
  }
  
  return true
}

// Main execution
async function main() {
  const scenario = process.argv[2] || 'all'
  
  console.log('🚀 DECODE Email Service Test')
  console.log('============================\n')
  
  // Check configuration first
  if (!checkConfiguration()) {
    console.error('\n❌ Configuration check failed. Please fix the issues above.')
    process.exit(1)
  }
  
  console.log('')
  
  // Run the specified scenario
  if (!scenarios[scenario]) {
    console.error(`❌ Unknown scenario: ${scenario}`)
    console.log('Available scenarios:', Object.keys(scenarios).join(', '))
    process.exit(1)
  }
  
  try {
    await scenarios[scenario]()
    console.log('\n🎉 Test completed successfully!')
  } catch (error) {
    console.error('\n💥 Test failed:', error.message)
    if (process.env.DEBUG_EMAIL) {
      console.error('Full error:', error)
    }
    process.exit(1)
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Test interrupted by user')
  process.exit(0)
})

process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled promise rejection:', error.message)
  process.exit(1)
})

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { scenarios, checkConfiguration }