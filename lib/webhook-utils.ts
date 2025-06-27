/**
 * Webhook Utilities for DECODE Payment Platform
 * 
 * Helper functions for webhook processing, testing, and monitoring
 */

import crypto from 'crypto'
import { supabase } from './supabase'

export interface WebhookTestResult {
  success: boolean
  message: string
  statusCode?: number
  responseTime?: number
  error?: string
}

/**
 * Verify webhook signature matches expected value
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    // Handle both 'sha256=hash' and just 'hash' formats
    const receivedSignature = signature.startsWith('sha256=') 
      ? signature.slice(7) 
      : signature
    
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
 * Generate webhook signature for testing
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return `sha256=${signature}`
}

/**
 * Validate webhook event structure
 */
export function validateWebhookEvent(event: any): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!event) {
    errors.push('Event payload is missing')
    return { isValid: false, errors }
  }

  if (!event.type || typeof event.type !== 'string') {
    errors.push('Event type is missing or invalid')
  }

  if (!event.data) {
    errors.push('Event data is missing')
  } else {
    if (!event.data.id) {
      errors.push('Event data.id is missing')
    }
    if (!event.data.status) {
      errors.push('Event data.status is missing')
    }
    if (typeof event.data.amount !== 'number') {
      errors.push('Event data.amount is missing or not a number')
    }
  }

  if (!event.timestamp) {
    errors.push('Event timestamp is missing')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get webhook processing statistics
 */
export async function getWebhookStats(days: number = 7): Promise<{
  totalEvents: number
  successfulEvents: number
  failedEvents: number
  eventTypes: Record<string, number>
  successRate: number
  avgProcessingTime?: number
}> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: events, error } = await supabase
      .from('webhook_events')
      .select('event_type, status, processed_at, created_at')
      .gte('created_at', startDate.toISOString())

    if (error) {
      throw error
    }

    const totalEvents = events?.length || 0
    const successfulEvents = events?.filter(e => e.status === 'processed').length || 0
    const failedEvents = events?.filter(e => e.status === 'failed').length || 0

    const eventTypes: Record<string, number> = {}
    events?.forEach(event => {
      eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1
    })

    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      eventTypes,
      successRate: Math.round(successRate * 100) / 100
    }
  } catch (error) {
    console.error('Error getting webhook stats:', error)
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      eventTypes: {},
      successRate: 0
    }
  }
}

/**
 * Test webhook endpoint health
 */
export async function testWebhookHealth(webhookUrl: string): Promise<WebhookTestResult> {
  const startTime = Date.now()
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    return {
      success: response.ok,
      message: response.ok ? 'Webhook endpoint is healthy' : 'Webhook endpoint returned error',
      statusCode: response.status,
      responseTime,
      error: response.ok ? undefined : responseText
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      success: false,
      message: 'Failed to connect to webhook endpoint',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send test webhook event
 */
export async function sendTestWebhook(
  webhookUrl: string,
  event: any,
  secret: string
): Promise<WebhookTestResult> {
  const startTime = Date.now()
  
  try {
    const payload = JSON.stringify(event)
    const signature = generateWebhookSignature(payload, secret)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crossmint-signature': signature
      },
      body: payload
    })

    const responseTime = Date.now() - startTime
    const responseText = await response.text()

    return {
      success: response.ok,
      message: response.ok ? 'Test webhook processed successfully' : 'Test webhook failed',
      statusCode: response.status,
      responseTime,
      error: response.ok ? undefined : responseText
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    return {
      success: false,
      message: 'Failed to send test webhook',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get recent webhook events for debugging
 */
export async function getRecentWebhookEvents(limit: number = 10): Promise<{
  events: Array<{
    id: string
    event_type: string
    status: string
    error_message?: string
    processed_at: string
    transaction_id?: string
  }>
  error?: string
}> {
  try {
    const { data: events, error } = await supabase
      .from('webhook_events')
      .select(`
        id,
        event_type,
        status,
        error_message,
        processed_at,
        event_data
      `)
      .order('processed_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { events: [], error: error.message }
    }

    const processedEvents = events?.map(event => ({
      id: event.id,
      event_type: event.event_type,
      status: event.status,
      error_message: event.error_message,
      processed_at: event.processed_at,
      transaction_id: event.event_data?.id
    })) || []

    return { events: processedEvents }
  } catch (error) {
    return { 
      events: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Retry failed webhook event
 */
export async function retryFailedWebhookEvent(eventId: string): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    const { data: event, error: fetchError } = await supabase
      .from('webhook_events')
      .select('event_data, event_type')
      .eq('id', eventId)
      .eq('status', 'failed')
      .single()

    if (fetchError || !event) {
      return {
        success: false,
        message: 'Failed webhook event not found',
        error: fetchError?.message
      }
    }

    // Re-process the event
    const { processWebhookEvent } = await import('./webhook-handlers')
    await processWebhookEvent({
      type: event.event_type,
      data: event.event_data,
      timestamp: new Date().toISOString()
    })

    // Update the event status
    await supabase
      .from('webhook_events')
      .update({
        status: 'processed',
        error_message: null,
        processed_at: new Date().toISOString()
      })
      .eq('id', eventId)

    return {
      success: true,
      message: 'Webhook event retried successfully'
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to retry webhook event',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Clean up old webhook events
 */
export async function cleanupOldWebhookEvents(daysToKeep: number = 90): Promise<{
  deletedCount: number
  error?: string
}> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { data, error } = await supabase
      .from('webhook_events')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id')

    if (error) {
      return { deletedCount: 0, error: error.message }
    }

    return { deletedCount: data?.length || 0 }
  } catch (error) {
    return {
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}