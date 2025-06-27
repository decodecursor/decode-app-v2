/**
 * Test script for Crossmint Webhook Handler
 * 
 * This script tests the webhook endpoint with sample payloads to ensure
 * proper processing of different event types.
 * 
 * Usage: node test-webhook-handler.js
 */

const crypto = require('crypto')

// Test configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/crossmint'
const WEBHOOK_SECRET = process.env.CROSSMINT_WEBHOOK_SECRET || 'test-secret-key'

// Sample webhook payloads for different event types
const sampleEvents = {
  paymentSucceeded: {
    type: 'payment.succeeded',
    data: {
      id: 'tx_test_' + Date.now(),
      status: 'completed',
      amount: 99.99,
      currency: 'USD',
      metadata: {
        paymentLinkId: '123e4567-e89b-12d3-a456-426614174000',
        creatorId: 'creator@example.com',
        buyerEmail: 'buyer@example.com',
        timestamp: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: {
        type: 'credit_card',
        details: {
          last4: '4242',
          brand: 'visa'
        }
      },
      customer: {
        email: 'buyer@example.com',
        id: 'cust_test_123'
      }
    },
    timestamp: new Date().toISOString()
  },

  paymentFailed: {
    type: 'payment.failed',
    data: {
      id: 'tx_failed_' + Date.now(),
      status: 'failed',
      amount: 149.99,
      currency: 'USD',
      metadata: {
        paymentLinkId: '123e4567-e89b-12d3-a456-426614174001',
        creatorId: 'creator@example.com',
        buyerEmail: 'buyer2@example.com'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: {
        type: 'credit_card',
        details: {
          last4: '0002',
          brand: 'visa'
        }
      },
      customer: {
        email: 'buyer2@example.com',
        id: 'cust_test_456'
      },
      error: {
        code: 'card_declined',
        message: 'Your card was declined.'
      }
    },
    timestamp: new Date().toISOString()
  },

  paymentPending: {
    type: 'payment.pending',
    data: {
      id: 'tx_pending_' + Date.now(),
      status: 'pending',
      amount: 75.50,
      currency: 'USD',
      metadata: {
        paymentLinkId: '123e4567-e89b-12d3-a456-426614174002',
        creatorId: 'creator@example.com',
        buyerEmail: 'buyer3@example.com'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: {
        type: 'bank_transfer',
        details: {
          bank: 'Test Bank'
        }
      },
      customer: {
        email: 'buyer3@example.com',
        id: 'cust_test_789'
      }
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Generate webhook signature
 */
function generateSignature(payload, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return `sha256=${signature}`
}

/**
 * Send test webhook
 */
async function sendTestWebhook(eventName, event) {
  const payload = JSON.stringify(event)
  const signature = generateSignature(payload, WEBHOOK_SECRET)

  console.log(`\n🧪 Testing ${eventName}...`)
  console.log(`Event ID: ${event.data.id}`)
  console.log(`Amount: $${event.data.amount}`)
  console.log(`Status: ${event.data.status}`)

  try {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crossmint-signature': signature
      },
      body: payload
    })

    const responseData = await response.text()
    
    if (response.ok) {
      console.log(`✅ ${eventName} processed successfully`)
      console.log(`Response: ${responseData}`)
    } else {
      console.log(`❌ ${eventName} failed`)
      console.log(`Status: ${response.status}`)
      console.log(`Response: ${responseData}`)
    }
  } catch (error) {
    console.error(`❌ Error sending ${eventName}:`, error.message)
  }
}

/**
 * Test webhook endpoint health
 */
async function testHealthCheck() {
  console.log('🏥 Testing webhook endpoint health...')
  
  try {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(WEBHOOK_URL, {
      method: 'GET'
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Webhook endpoint is healthy')
      console.log('Response:', data)
    } else {
      console.log(`❌ Health check failed: ${response.status}`)
    }
  } catch (error) {
    console.error('❌ Error checking health:', error.message)
  }
}

/**
 * Test invalid signature
 */
async function testInvalidSignature() {
  console.log('\n🔒 Testing invalid signature handling...')
  
  const event = sampleEvents.paymentSucceeded
  const payload = JSON.stringify(event)
  const invalidSignature = 'sha256=invalid_signature_here'

  try {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crossmint-signature': invalidSignature
      },
      body: payload
    })

    if (response.status === 401) {
      console.log('✅ Invalid signature properly rejected')
    } else {
      console.log(`❌ Expected 401, got ${response.status}`)
    }
  } catch (error) {
    console.error('❌ Error testing invalid signature:', error.message)
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Crossmint Webhook Tests')
  console.log(`Webhook URL: ${WEBHOOK_URL}`)
  console.log(`Using secret: ${WEBHOOK_SECRET ? '[CONFIGURED]' : '[NOT CONFIGURED]'}`)

  // Test health check
  await testHealthCheck()

  // Test different event types
  for (const [eventName, event] of Object.entries(sampleEvents)) {
    await sendTestWebhook(eventName, event)
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Test security
  await testInvalidSignature()

  console.log('\n🏁 Webhook tests completed')
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = {
  runTests,
  sendTestWebhook,
  sampleEvents
}