/**
 * AUTHKEY WhatsApp Webhook Handler
 * Receives delivery status updates from AUTHKEY BSP
 *
 * Webhook URL: https://app.welovedecode.com/api/webhooks/authkey
 *
 * Expected fields from AUTHKEY:
 * - Mobile: Recipient phone number
 * - Email: Recipient email (if any)
 * - Status: Delivery status
 * - Log ID: AUTHKEY message ID
 * - Time: Timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';

// Map AUTHKEY status to our status
function mapAuthkeyStatus(status: string): 'sent' | 'delivered' | 'read' | 'failed' | null {
  const normalized = status.toLowerCase().trim();

  // Common status mappings (adjust based on actual AUTHKEY values)
  if (normalized.includes('delivered') || normalized.includes('success')) {
    return 'delivered';
  }
  if (normalized.includes('read') || normalized.includes('seen')) {
    return 'read';
  }
  if (normalized.includes('sent') || normalized.includes('submitted')) {
    return 'sent';
  }
  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('reject')) {
    return 'failed';
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[AUTHKEY Webhook] Received:', JSON.stringify(body, null, 2));

    // Extract fields from AUTHKEY webhook
    // Field names may vary - adjust based on actual AUTHKEY format
    const mobile = body.Mobile || body.mobile || body.phone;
    const logId = body['Log ID'] || body.LogId || body.log_id || body.messageId;
    const status = body.Status || body.status;
    const time = body.Time || body.time || body.timestamp;

    if (!mobile && !logId) {
      console.warn('[AUTHKEY Webhook] Missing identifier (Mobile or Log ID)');
      return NextResponse.json(
        { error: 'Missing identifier' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Try to find the message by Log ID first, then by phone
    let query = supabase.from('whatsapp_messages').select('*');

    if (logId) {
      query = query.eq('authkey_message_id', logId);
    } else if (mobile) {
      // Normalize mobile number (remove leading zeros, spaces)
      const normalizedMobile = mobile.replace(/^0+/, '').replace(/\s/g, '');
      query = query.eq('phone', normalizedMobile);
    }

    // Get the most recent matching message
    const { data: messages, error: fetchError } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[AUTHKEY Webhook] Database error:', fetchError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      console.warn('[AUTHKEY Webhook] No matching message found:', { logId, mobile });
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ received: true, matched: false });
    }

    const message = messages[0];

    // Map status
    const mappedStatus = status ? mapAuthkeyStatus(status) : null;

    // Build update object
    const updateData: Record<string, unknown> = {
      webhook_payload: body,
      updated_at: new Date().toISOString(),
    };

    if (mappedStatus) {
      updateData.status = mappedStatus;

      // Set appropriate timestamp
      switch (mappedStatus) {
        case 'sent':
          if (!message.sent_at) updateData.sent_at = time || new Date().toISOString();
          break;
        case 'delivered':
          updateData.delivered_at = time || new Date().toISOString();
          break;
        case 'read':
          updateData.read_at = time || new Date().toISOString();
          break;
        case 'failed':
          updateData.failed_at = time || new Date().toISOString();
          updateData.error_message = body.error || body.Error || status;
          break;
      }
    }

    // Update the message record
    const { error: updateError } = await supabase
      .from('whatsapp_messages')
      .update(updateData)
      .eq('id', message.id);

    if (updateError) {
      console.error('[AUTHKEY Webhook] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      );
    }

    console.log('[AUTHKEY Webhook] Updated message:', {
      id: message.id,
      status: mappedStatus,
      logId,
    });

    return NextResponse.json({
      received: true,
      matched: true,
      messageId: message.id,
      status: mappedStatus,
    });

  } catch (error) {
    console.error('[AUTHKEY Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also handle GET for webhook verification (if AUTHKEY requires it)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'AUTHKEY webhook endpoint is active',
  });
}
