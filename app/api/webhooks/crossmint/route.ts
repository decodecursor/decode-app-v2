import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { processWebhookEvent } from '@/lib/webhook-handlers'

/**
 * Crossmint Webhook Handler
 * 
 * This endpoint handles incoming webhook events from Crossmint payment processor.
 * It verifies webhook signatures, processes payment events, and updates the database.
 */

interface CrossmintWebhookEvent {
  type: string
  data: {
    id: string
    status: string
    amount: number
    currency: string
    metadata?: {
      paymentLinkId?: string
      creatorId?: string
      buyerEmail?: string
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
  signature?: string
  timestamp: string
}

/**
 * Verify Crossmint webhook signature
 */
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    // Crossmint typically sends signature as 'sha256=<hash>'
    const receivedSignature = signature.replace('sha256=', '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(
  event: CrossmintWebhookEvent,
  status: 'received' | 'processed' | 'failed',
  error?: string
) {
  try {
    await supabase.from('webhook_events').insert({
      event_type: event.type,
      event_data: event.data,
      signature: event.signature,
      timestamp: event.timestamp,
      status,
      error_message: error,
      processed_at: new Date().toISOString()
    })
  } catch (logError) {
    console.error('Error logging webhook event:', logError)
    // Don't throw here to avoid breaking webhook processing
  }
}

/**
 * POST handler for Crossmint webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('CROSSMINT_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Get request headers
    const headersList = await headers()
    const signature = headersList.get('x-crossmint-signature') || headersList.get('signature')
    const contentType = headersList.get('content-type')

    // Validate content type
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      )
    }

    // Get raw payload
    const payload = await request.text()
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Empty payload' },
        { status: 400 }
      )
    }

    // Verify signature if provided
    if (signature) {
      const isValidSignature = await verifyWebhookSignature(payload, signature, webhookSecret)
      if (!isValidSignature) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    } else {
      console.warn('No signature provided for webhook - this may be a security risk in production')
    }

    // Parse the event
    let event: CrossmintWebhookEvent
    try {
      event = JSON.parse(payload)
    } catch (parseError) {
      console.error('Error parsing webhook payload:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!event.type || !event.data || !event.timestamp) {
      console.error('Missing required webhook fields:', { type: event.type, hasData: !!event.data, timestamp: event.timestamp })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Log the received event
    await logWebhookEvent(event, 'received')

    console.log(`🔗 Processing webhook event: ${event.type}`, {
      eventId: event.data.id,
      status: event.data.status,
      amount: event.data.amount,
      paymentLinkId: event.data.metadata?.paymentLinkId
    })

    // Process the webhook event
    try {
      await processWebhookEvent(event)
      
      // Log successful processing
      await logWebhookEvent(event, 'processed')
      
      console.log(`✅ Successfully processed webhook event: ${event.type}`)
      
      return NextResponse.json(
        { 
          success: true, 
          message: 'Webhook processed successfully',
          eventType: event.type,
          eventId: event.data.id
        },
        { status: 200 }
      )
    } catch (processingError) {
      console.error('Error processing webhook event:', processingError)
      
      // Log failed processing
      await logWebhookEvent(event, 'failed', processingError instanceof Error ? processingError.message : 'Unknown processing error')
      
      return NextResponse.json(
        { 
          error: 'Error processing webhook event',
          eventType: event.type,
          eventId: event.data.id
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Unexpected error in webhook handler:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET handler for webhook endpoint health check
 */
export async function GET() {
  return NextResponse.json(
    { 
      message: 'Crossmint webhook endpoint is active',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    },
    { status: 200 }
  )
}

/**
 * Reject all other HTTP methods
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, GET',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET',
      'Access-Control-Allow-Headers': 'Content-Type, x-crossmint-signature, signature'
    }
  })
}

// Export the supported methods
export const runtime = 'nodejs'