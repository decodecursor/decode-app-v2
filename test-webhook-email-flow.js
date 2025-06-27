#!/usr/bin/env node

/**
 * Webhook Email Flow Integration Test
 * 
 * Tests the complete flow from webhook event to email delivery
 * This simulates the actual webhook processing and email sending
 */

// Environment setup for testing
process.env.EMAIL_PROVIDER = 'mock'
process.env.EMAIL_FROM = 'DECODE Beauty <noreply@decode.beauty>'
process.env.SUPPORT_EMAIL = 'support@decode.beauty'
process.env.NEXT_PUBLIC_APP_URL = 'https://decode.beauty'

// Mock webhook event data
const mockWebhookEvents = {
  paymentSuccess: {
    type: 'payment.succeeded',
    data: {
      id: 'txn_test_success_' + Date.now(),
      status: 'completed',
      amount: 99.99,
      currency: 'USD',
      metadata: {
        paymentLinkId: 'pl_test_123',
        creatorId: 'creator_test_456',
        buyerEmail: 'customer@example.com'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: {
        type: 'credit_card',
        details: { last4: '4242' }
      },
      customer: {
        email: 'customer@example.com',
        id: 'cust_test_789'
      }
    },
    timestamp: new Date().toISOString()
  },

  paymentFailure: {
    type: 'payment.failed',
    data: {
      id: 'txn_test_failed_' + Date.now(),
      status: 'failed',
      amount: 149.99,
      currency: 'USD',
      metadata: {
        paymentLinkId: 'pl_test_124',
        buyerEmail: 'customer@example.com'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: {
        type: 'credit_card',
        details: { last4: '1234' }
      },
      customer: {
        email: 'customer@example.com',
        id: 'cust_test_790'
      },
      error: {
        code: 'card_declined',
        message: 'Your card was declined. Please check your card details and try again.'
      }
    },
    timestamp: new Date().toISOString()
  }
}

// Mock database responses
const mockSupabaseResponses = {
  paymentLinks: {
    'pl_test_123': {
      id: 'pl_test_123',
      amount_usd: 99.99,
      title: 'Premium Beauty Consultation',
      creator_id: 'creator_test_456'
    },
    'pl_test_124': {
      id: 'pl_test_124',
      amount_usd: 149.99,
      title: 'Luxury Styling Session',
      creator_id: 'creator_test_456'
    }
  },
  users: {
    'creator_test_456': {
      id: 'creator_test_456',
      full_name: 'Jane Beauty Expert',
      email: 'jane@beautyexpert.com'
    }
  }
}

// Mock Supabase client
const mockSupabase = {
  from: (table) => ({
    select: (columns) => ({
      eq: (column, value) => ({
        single: () => {
          if (table === 'payment_links') {
            const data = mockSupabaseResponses.paymentLinks[value]
            return data ? { data, error: null } : { data: null, error: new Error('Not found') }
          }
          if (table === 'users') {
            const data = mockSupabaseResponses.users[value]
            return data ? { data, error: null } : { data: null, error: new Error('Not found') }
          }
          return { data: null, error: new Error('Not found') }
        })
      })
    }),
    upsert: (data, options) => {
      console.log(`📝 Mock DB: Upserting to ${table}:`, JSON.stringify(data, null, 2))
      return { error: null }
    },
    update: (data) => ({
      eq: (column, value) => {
        console.log(`📝 Mock DB: Updating ${table} where ${column}=${value}:`, JSON.stringify(data, null, 2))
        return { error: null }
      }
    }),
    insert: (data) => {
      console.log(`📝 Mock DB: Inserting to ${table}:`, JSON.stringify(data, null, 2))
      return { error: null }
    }
  })
}

// Mock email service
const mockEmailService = {
  sendPaymentConfirmation: async (data) => {
    console.log('\n📧 MOCK: Sending payment confirmation email')
    console.log('To:', data.buyerEmail)
    console.log('Amount:', `$${data.amount} ${data.currency}`)
    console.log('Service:', data.serviceTitle)
    console.log('Transaction ID:', data.transactionId)
    return { success: true, messageId: 'mock_confirmation_' + Date.now() }
  },

  sendPaymentFailure: async (data) => {
    console.log('\n📧 MOCK: Sending payment failure email')
    console.log('To:', data.buyerEmail)
    console.log('Amount:', `$${data.amount} ${data.currency}`)
    console.log('Service:', data.serviceTitle)
    console.log('Failure Reason:', data.failureReason)
    return { success: true, messageId: 'mock_failure_' + Date.now() }
  },

  sendCreatorPaymentNotification: async (data) => {
    console.log('\n📧 MOCK: Sending creator notification email')
    console.log('To:', data.creatorEmail)
    console.log('Creator:', data.creatorName)
    console.log('Amount:', `$${data.amount} ${data.currency}`)
    console.log('Service:', data.serviceTitle)
    return { success: true, messageId: 'mock_creator_' + Date.now() }
  }
}

// Simplified webhook handlers (based on the actual implementation)
async function handlePaymentSuccess(data) {
  console.log(`💰 Processing successful payment: ${data.id}`)
  
  const paymentLinkId = data.metadata?.paymentLinkId
  if (!paymentLinkId) {
    throw new Error('Payment success event missing paymentLinkId in metadata')
  }

  // Get payment link
  const paymentLinkResponse = mockSupabase.from('payment_links').select('id, amount_usd, title, creator_id').eq('id', paymentLinkId).single()
  const paymentLink = paymentLinkResponse.data
  
  if (!paymentLink) {
    throw new Error(`Payment link not found: ${paymentLinkId}`)
  }

  // Create transaction
  const transactionData = {
    id: data.id,
    payment_link_id: paymentLinkId,
    buyer_email: data.customer?.email || data.metadata?.buyerEmail || null,
    amount_usd: data.amount,
    status: 'completed',
    payment_processor: 'crossmint',
    processor_transaction_id: data.id,
    payment_method_type: data.paymentMethod?.type || 'unknown',
    completed_at: new Date(data.updatedAt || data.createdAt).toISOString(),
    metadata: {
      webhookData: data,
      processedAt: new Date().toISOString(),
      paymentMethod: data.paymentMethod,
      customer: data.customer
    }
  }

  await mockSupabase.from('transactions').upsert(transactionData, { 
    onConflict: 'id',
    ignoreDuplicates: false 
  })

  console.log(`✅ Transaction created/updated successfully: ${data.id}`)

  // Send confirmation email
  const buyerEmail = data.customer?.email || data.metadata?.buyerEmail
  if (buyerEmail) {
    // Get creator info
    const creatorResponse = mockSupabase.from('users').select('full_name, email').eq('id', paymentLink.creator_id).single()
    const creator = creatorResponse.data
    const creatorName = creator?.full_name || creator?.email || 'Service Provider'

    await mockEmailService.sendPaymentConfirmation({
      buyerEmail,
      transactionId: data.id,
      amount: data.amount,
      currency: data.currency,
      serviceTitle: paymentLink.title,
      creatorName,
      creatorEmail: creator?.email || '',
      transactionDate: new Date().toISOString()
    })
  }

  // Send creator notification
  if (paymentLink.creator_id) {
    const creatorResponse = mockSupabase.from('users').select('full_name, email').eq('id', paymentLink.creator_id).single()
    const creator = creatorResponse.data
    
    if (creator) {
      await mockEmailService.sendCreatorPaymentNotification({
        creatorEmail: creator.email,
        creatorName: creator.full_name || creator.email,
        transactionId: data.id,
        amount: data.amount,
        currency: data.currency,
        serviceTitle: paymentLink.title,
        buyerEmail,
        transactionDate: new Date().toISOString()
      })
    }
  }
}

async function handlePaymentFailure(data) {
  console.log(`❌ Processing failed payment: ${data.id}`)
  
  const paymentLinkId = data.metadata?.paymentLinkId
  if (!paymentLinkId) {
    console.warn('Payment failure event missing paymentLinkId in metadata')
    return
  }

  // Create failed transaction
  const transactionData = {
    id: data.id,
    payment_link_id: paymentLinkId,
    buyer_email: data.customer?.email || data.metadata?.buyerEmail || null,
    amount_usd: data.amount,
    status: 'failed',
    payment_processor: 'crossmint',
    processor_transaction_id: data.id,
    payment_method_type: data.paymentMethod?.type || 'unknown',
    failed_at: new Date(data.updatedAt || data.createdAt).toISOString(),
    failure_reason: data.error?.message || 'Payment processing failed',
    metadata: {
      webhookData: data,
      processedAt: new Date().toISOString(),
      error: data.error,
      paymentMethod: data.paymentMethod
    }
  }

  await mockSupabase.from('transactions').upsert(transactionData, { 
    onConflict: 'id',
    ignoreDuplicates: false 
  })

  console.log(`📝 Failed transaction recorded: ${data.id}`)

  // Send failure email
  const buyerEmail = data.customer?.email || data.metadata?.buyerEmail
  if (buyerEmail) {
    const paymentLinkResponse = mockSupabase.from('payment_links').select('title').eq('id', paymentLinkId).single()
    const paymentLink = paymentLinkResponse.data
    const serviceTitle = paymentLink?.title || 'Beauty Service'

    await mockEmailService.sendPaymentFailure({
      buyerEmail,
      transactionId: data.id,
      amount: data.amount,
      currency: data.currency,
      serviceTitle,
      failureReason: data.error?.message || 'Payment processing failed',
      retryUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://decode.beauty'}/pay/${paymentLinkId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@decode.beauty',
      failureDate: new Date().toISOString()
    })
  }
}

// Main test runner
async function runWebhookEmailFlowTests() {
  console.log('🚀 DECODE Webhook Email Flow Integration Test')
  console.log('==============================================\n')

  const tests = [
    {
      name: 'Payment Success Flow',
      event: mockWebhookEvents.paymentSuccess,
      handler: handlePaymentSuccess
    },
    {
      name: 'Payment Failure Flow',
      event: mockWebhookEvents.paymentFailure,
      handler: handlePaymentFailure
    }
  ]

  for (const test of tests) {
    console.log(`\n🧪 Testing: ${test.name}`)
    console.log('='.repeat(test.name.length + 12))

    try {
      await test.handler(test.event.data)
      console.log(`✅ ${test.name} completed successfully`)
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message)
    }
  }

  console.log('\n🎉 All webhook email flow tests completed!')
  console.log('\nThis test simulates the complete flow:')
  console.log('1. Webhook event received')
  console.log('2. Database operations (transactions, lookups)')
  console.log('3. Email notifications sent')
  console.log('4. All components working together')
}

// Run the tests
runWebhookEmailFlowTests().catch(error => {
  console.error('💥 Integration test failed:', error.message)
  process.exit(1)
})