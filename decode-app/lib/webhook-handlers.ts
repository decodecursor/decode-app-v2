import { supabase } from './supabase'
import { emailService } from './email-service'

/**
 * Webhook Event Handlers for DECODE Payment Platform
 * 
 * This module processes different types of webhook events from Crossmint
 * and updates the database accordingly.
 */

interface WebhookEventData {
  id: string
  status: string
  amount: number
  currency: string
  metadata?: {
    paymentLinkId?: string
    creatorId?: string
    buyerEmail?: string
    timestamp?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
  paymentMethod?: {
    type: string
    details: any
  }
  customer?: {
    email?: string
    id?: string
  }
  error?: {
    code: string
    message: string
  }
}

interface WebhookEvent {
  type: string
  data: WebhookEventData
  timestamp: string
  signature?: string
}

/**
 * Main webhook event processor
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  console.log(`Processing webhook event: ${event.type}`)
  
  switch (event.type) {
    case 'payment.succeeded':
    case 'payment.completed':
      await handlePaymentSuccess(event.data)
      break
      
    case 'payment.failed':
    case 'payment.declined':
      await handlePaymentFailure(event.data)
      break
      
    case 'payment.pending':
    case 'payment.processing':
      await handlePaymentPending(event.data)
      break
      
    case 'payment.cancelled':
    case 'payment.refunded':
      await handlePaymentCancellation(event.data)
      break
      
    case 'payment.expired':
      await handlePaymentExpiration(event.data)
      break
      
    default:
      console.warn(`Unhandled webhook event type: ${event.type}`)
      // Still log unknown events but don't throw an error
      await logUnhandledEvent(event)
  }
}

/**
 * Handle successful payment events
 */
async function handlePaymentSuccess(data: WebhookEventData): Promise<void> {
  console.log(`💰 Processing successful payment: ${data.id}`)
  
  const paymentLinkId = data.metadata?.paymentLinkId
  if (!paymentLinkId) {
    throw new Error('Payment success event missing paymentLinkId in metadata')
  }

  // First, verify the payment link exists
  const { data: paymentLink, error: linkError } = await supabase
    .from('payment_links')
    .select('id, amount_aed, title, creator_id')
    .eq('id', paymentLinkId)
    .single()

  if (linkError || !paymentLink) {
    throw new Error(`Payment link not found: ${paymentLinkId}`)
  }

  // Create or update transaction record
  const transactionData = {
    id: data.id,
    payment_link_id: paymentLinkId,
    buyer_email: data.customer?.email || data.metadata?.buyerEmail || null,
    amount_aed: data.amount,
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
    } as any
  }

  // Use upsert to handle duplicate webhook deliveries
  const { error: transactionError } = await supabase
    .from('transactions')
    .upsert(transactionData, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })

  if (transactionError) {
    console.error('Error creating/updating transaction:', transactionError)
    throw new Error(`Failed to create transaction: ${transactionError.message}`)
  }

  console.log(`✅ Transaction created/updated successfully: ${data.id}`)

  // Send confirmation email if buyer email is available
  const buyerEmail = data.customer?.email || data.metadata?.buyerEmail
  if (buyerEmail) {
    await sendPaymentConfirmationEmail({
      buyerEmail,
      transactionId: data.id,
      amount: data.amount,
      currency: data.currency,
      serviceTitle: paymentLink.title,
      creatorId: paymentLink.creator_id
    })
  }

  // Send notification to creator
  await sendCreatorPaymentNotification(paymentLinkId, data)

  // Update payment link statistics (optional)
  await updatePaymentLinkStats(paymentLinkId)
}

/**
 * Handle failed payment events
 */
async function handlePaymentFailure(data: WebhookEventData): Promise<void> {
  console.log(`❌ Processing failed payment: ${data.id}`)
  
  const paymentLinkId = data.metadata?.paymentLinkId
  if (!paymentLinkId) {
    console.warn('Payment failure event missing paymentLinkId in metadata')
    return
  }

  // Create failed transaction record
  const transactionData = {
    id: data.id,
    payment_link_id: paymentLinkId,
    buyer_email: data.customer?.email || data.metadata?.buyerEmail || null,
    amount_aed: data.amount,
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
    } as any
  }

  const { error: transactionError } = await supabase
    .from('transactions')
    .upsert(transactionData, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })

  if (transactionError) {
    console.error('Error creating failed transaction:', transactionError)
    throw new Error(`Failed to create failed transaction: ${transactionError.message}`)
  }

  console.log(`📝 Failed transaction recorded: ${data.id}`)

  // Send failure email to buyer if email is available
  const buyerEmail = data.customer?.email || data.metadata?.buyerEmail
  if (buyerEmail) {
    await sendPaymentFailureEmail(data, paymentLinkId)
  }

  // Optionally notify the creator about the failed payment
  await notifyCreatorOfFailedPayment(paymentLinkId, data)
}

/**
 * Handle pending payment events
 */
async function handlePaymentPending(data: WebhookEventData): Promise<void> {
  console.log(`⏳ Processing pending payment: ${data.id}`)
  
  const paymentLinkId = data.metadata?.paymentLinkId
  if (!paymentLinkId) {
    console.warn('Payment pending event missing paymentLinkId in metadata')
    return
  }

  // Create or update pending transaction record
  const transactionData = {
    id: data.id,
    payment_link_id: paymentLinkId,
    buyer_email: data.customer?.email || data.metadata?.buyerEmail || null,
    amount_aed: data.amount,
    status: 'pending',
    payment_processor: 'crossmint',
    processor_transaction_id: data.id,
    payment_method_type: data.paymentMethod?.type || 'unknown',
    metadata: {
      webhookData: data,
      processedAt: new Date().toISOString(),
      paymentMethod: data.paymentMethod
    } as any
  }

  const { error: transactionError } = await supabase
    .from('transactions')
    .upsert(transactionData, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })

  if (transactionError) {
    console.error('Error creating pending transaction:', transactionError)
    throw new Error(`Failed to create pending transaction: ${transactionError.message}`)
  }

  console.log(`📝 Pending transaction recorded: ${data.id}`)
}

/**
 * Handle payment cancellation/refund events
 */
async function handlePaymentCancellation(data: WebhookEventData): Promise<void> {
  console.log(`🔄 Processing payment cancellation/refund: ${data.id}`)
  
  // Update existing transaction status
  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      status: data.status === 'refunded' ? 'refunded' : 'cancelled',
      refunded_at: data.status === 'refunded' ? new Date().toISOString() : null,
      cancelled_at: data.status === 'cancelled' ? new Date().toISOString() : null,
      metadata: JSON.parse(JSON.stringify({
        webhookData: data,
        processedAt: new Date().toISOString()
      }))
    })
    .eq('processor_transaction_id', data.id)

  if (updateError) {
    console.error('Error updating cancelled transaction:', updateError)
    throw new Error(`Failed to update cancelled transaction: ${updateError.message}`)
  }

  console.log(`✅ Transaction status updated to ${data.status}: ${data.id}`)
}

/**
 * Handle payment expiration events
 */
async function handlePaymentExpiration(data: WebhookEventData): Promise<void> {
  console.log(`⏰ Processing payment expiration: ${data.id}`)
  
  // Update transaction status if it exists
  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      status: 'expired',
      expired_at: new Date().toISOString(),
      metadata: JSON.parse(JSON.stringify({
        webhookData: data,
        processedAt: new Date().toISOString()
      }))
    })
    .eq('processor_transaction_id', data.id)

  if (updateError) {
    console.error('Error updating expired transaction:', updateError)
    // Don't throw here as the transaction might not exist yet
  }

  console.log(`📝 Transaction marked as expired: ${data.id}`)
}

/**
 * Send payment confirmation email to buyer
 */
async function sendPaymentConfirmationEmail({
  buyerEmail,
  transactionId,
  amount,
  currency,
  serviceTitle,
  creatorId
}: {
  buyerEmail: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  creatorId: string
}): Promise<void> {
  try {
    // Get creator information
    const { data: creator } = await supabase
      .from('users')
      .select('user_name, email')
      .eq('id', creatorId)
      .single()

    const creatorName = creator?.user_name || creator?.email || 'Service Provider'
    const creatorEmail = creator?.email || ''

    // Send payment confirmation email
    const result = await emailService.sendPaymentConfirmation({
      buyerEmail,
      transactionId,
      amount,
      currency,
      serviceTitle,
      creatorName,
      creatorEmail,
      transactionDate: new Date().toISOString()
    })

    if (result.success) {
      console.log(`✅ Payment confirmation email sent to ${buyerEmail}`)
    } else {
      console.error(`❌ Failed to send confirmation email: ${result.error}`)
    }

  } catch (error) {
    console.error('Error sending confirmation email:', error)
    // Don't throw here to avoid breaking webhook processing
  }
}

/**
 * Send payment failure email to buyer
 */
async function sendPaymentFailureEmail(
  data: WebhookEventData,
  paymentLinkId: string
): Promise<void> {
  try {
    const buyerEmail = data.customer?.email || data.metadata?.buyerEmail
    if (!buyerEmail) return

    // Get payment link information
    const { data: paymentLink } = await supabase
      .from('payment_links')
      .select('title')
      .eq('id', paymentLinkId)
      .single()

    const serviceTitle = paymentLink?.title || 'Beauty Service'

    // Send payment failure email
    const result = await emailService.sendPaymentFailure({
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

    if (result.success) {
      console.log(`✅ Payment failure email sent to ${buyerEmail}`)
    } else {
      console.error(`❌ Failed to send failure email: ${result.error}`)
    }

  } catch (error) {
    console.error('Error sending payment failure email:', error)
    // Don't throw here to avoid breaking webhook processing
  }
}

/**
 * Notify creator of failed payment
 */
async function notifyCreatorOfFailedPayment(
  paymentLinkId: string,
  failureData: WebhookEventData
): Promise<void> {
  try {
    // Get creator information
    const { data: paymentLink } = await supabase
      .from('payment_links')
      .select(`
        creator_id,
        title,
        creator:creator_id (
          email,
          user_name
        )
      `)
      .eq('id', paymentLinkId)
      .single()

    if (paymentLink && paymentLink.creator) {
      const creator = Array.isArray(paymentLink.creator) ? paymentLink.creator[0] : paymentLink.creator
      
      // Send failure notification to creator (optional - you may not want to notify creators of every failed payment)
      if (creator && creator.email) {
        console.log(`📧 Notifying creator ${creator.email} of failed payment for: ${paymentLink.title}`)
        
        // For now, just log this. In the future, you could send an email to the creator
        // if they have opted in to failure notifications
      }
    }
  } catch (error) {
    console.error('Error notifying creator of failed payment:', error)
  }
}

/**
 * Send notification to creator about successful payment
 */
async function sendCreatorPaymentNotification(
  paymentLinkId: string,
  data: WebhookEventData
): Promise<void> {
  try {
    // Get creator information
    const { data: paymentLink } = await supabase
      .from('payment_links')
      .select(`
        creator_id,
        title,
        creator:creator_id (
          email,
          user_name
        )
      `)
      .eq('id', paymentLinkId)
      .single()

    if (paymentLink && paymentLink.creator) {
      const creator = Array.isArray(paymentLink.creator) ? paymentLink.creator[0] : paymentLink.creator
      
      if (creator && creator.email) {
        const buyerEmail = data.customer?.email || data.metadata?.buyerEmail

        // Send creator notification
        const result = await emailService.sendCreatorPaymentNotification({
          creatorEmail: creator.email,
          creatorName: creator.user_name || creator.email,
          transactionId: data.id,
          amount: data.amount,
          currency: data.currency,
          serviceTitle: paymentLink.title,
          buyerEmail,
          transactionDate: new Date().toISOString()
        })

        if (result.success) {
          console.log(`✅ Creator notification sent to ${creator.email}`)
        } else {
          console.error(`❌ Failed to send creator notification: ${result.error}`)
        }
      }
    }
  } catch (error) {
    console.error('Error sending creator notification:', error)
  }
}

/**
 * Update payment link statistics
 */
async function updatePaymentLinkStats(paymentLinkId: string): Promise<void> {
  try {
    // This could update cached statistics, trigger analytics updates, etc.
    console.log(`📊 Updating stats for payment link: ${paymentLinkId}`)
    
    // Example: Update a stats cache table
    // const { data: stats } = await supabase.rpc('update_payment_link_stats', {
    //   link_id: paymentLinkId
    // })
    
  } catch (error) {
    console.error('Error updating payment link stats:', error)
    // Don't throw here to avoid breaking webhook processing
  }
}

/**
 * Log unhandled webhook events for future reference
 */
async function logUnhandledEvent(event: WebhookEvent): Promise<void> {
  try {
    await supabase.from('webhook_events').insert({
      event_type: event.type,
      event_data: JSON.parse(JSON.stringify(event.data)),
      signature: event.signature,
      timestamp: event.timestamp,
      status: 'unhandled',
      error_message: `Unhandled event type: ${event.type}`,
      processed_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error logging unhandled event:', error)
  }
}

/**
 * Validate webhook event data
 */
export function validateWebhookEventData(data: WebhookEventData): boolean {
  if (!data.id || !data.status || typeof data.amount !== 'number') {
    return false
  }
  
  if (!data.metadata?.paymentLinkId) {
    console.warn('Webhook event missing paymentLinkId in metadata')
    // Some events might not have paymentLinkId, so don't fail validation
  }
  
  return true
}

/**
 * Get webhook event processing status
 */
export async function getWebhookEventStatus(eventId: string): Promise<{
  exists: boolean
  status?: string
  processedAt?: string
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('status, processed_at, error_message')
      .eq('event_data->>id', eventId)
      .order('processed_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      return { exists: false }
    }

    return {
      exists: true,
      status: data.status,
      processedAt: data.processed_at,
      error: data.error_message || undefined
    }
  } catch (error) {
    console.error('Error checking webhook event status:', error)
    return { exists: false }
  }
}