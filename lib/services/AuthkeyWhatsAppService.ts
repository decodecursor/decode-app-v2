/**
 * AUTHKEY WhatsApp Service
 * Handles sending WhatsApp messages via AUTHKEY BSP API
 * Used for both auth OTP and auction notifications
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { parseE164, isValidE164 } from '@/lib/phone-utils';

// Template IDs from AUTHKEY console
export const AUTHKEY_TEMPLATES = {
  AUTH_OTP: '21835',           // auth_template - for OTP login
  BID_CONFIRMATION: '21831',   // bid_confirmation_1 - for bid placed
} as const;

export interface SendTemplateParams {
  phone: string;                          // E.164 format
  templateWid: string;                    // Template ID from AUTHKEY
  templateName: string;                   // Human-readable template name
  bodyValues: Record<string, string>;     // Placeholder values
  bidId?: string;                         // Optional bid reference
  bidderId?: string;                      // Optional bidder reference
}

export interface SendTemplateResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BidConfirmationParams {
  bidId: string;
  phone: string;
  bidderName: string;
  bidAmount: number;
  auctionTitle: string;
  modelName: string;
}

/**
 * AUTHKEY WhatsApp Service Class
 */
class AuthkeyWhatsAppService {
  private apiKey: string;
  private apiUrl = 'https://console.authkey.io/restapi/requestjson.php';

  constructor() {
    this.apiKey = process.env.AUTHKEY_API_KEY || '';

    if (!this.apiKey) {
      console.error('[AuthkeyWhatsApp] Missing AUTHKEY_API_KEY environment variable');
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a WhatsApp template message via AUTHKEY
   */
  async sendTemplate(params: SendTemplateParams): Promise<SendTemplateResult> {
    const { phone, templateWid, templateName, bodyValues, bidId, bidderId } = params;

    // Validate phone number
    if (!isValidE164(phone)) {
      return { success: false, error: 'Invalid phone number format. Use E.164 format (e.g., +971501234567)' };
    }

    // Parse phone number
    const parsed = parseE164(phone);
    if (!parsed.isValid) {
      return { success: false, error: 'Could not parse phone number' };
    }

    const supabase = createServiceRoleClient();

    // Create message log entry
    const { data: messageLog, error: logError } = await supabase
      .from('whatsapp_messages')
      .insert({
        bid_id: bidId || null,
        bidder_id: bidderId || null,
        phone: parsed.mobile,
        country_code: parsed.countryCode,
        template_name: templateName,
        template_wid: templateWid,
        template_data: bodyValues,
        status: 'queued',
      })
      .select()
      .single();

    if (logError) {
      console.error('[AuthkeyWhatsApp] Failed to create message log:', logError);
      // Continue anyway - logging should not block sending
    }

    try {
      // Build request body - mobile needs country code prefix for WhatsApp lookup
      const requestBody = {
        country_code: parsed.countryCode,
        mobile: `${parsed.countryCode}${parsed.mobile}`,  // WITH country code prefix
        wid: templateWid,
        type: 'text',
        bodyValues: bodyValues,
      };

      console.log('[AuthkeyWhatsApp] Sending template message:', {
        template: templateName,
        wid: templateWid,
        mobile: `${parsed.countryCode}${parsed.mobile}`,
        country_code: parsed.countryCode,
      });

      const response = await fetch('https://console.authkey.io/restapi/requestjson.php', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.apiKey}`,  // Auth in header per docs
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      // Update message log with response
      if (messageLog) {
        const updateData: Record<string, unknown> = {
          provider_response: data,
          updated_at: new Date().toISOString(),
        };

        const dbIsSuccess =
          data.Message === 'Submitted Successfully' ||
          data.message?.whatsapp === 'Submitted Successfully';

        if (response.ok && dbIsSuccess) {
          updateData.status = 'sent';
          updateData.sent_at = new Date().toISOString();
          updateData.authkey_message_id = data.LogID || data.LogId || null;
        } else {
          updateData.status = 'failed';
          updateData.failed_at = new Date().toISOString();
          updateData.error_message = data.Message || data.error || 'Unknown error';
        }

        await supabase
          .from('whatsapp_messages')
          .update(updateData)
          .eq('id', messageLog.id);
      }

      // AUTHKEY returns HTTP 400 even on success - check response body instead
      const isSuccess =
        data.Message === 'Submitted Successfully' ||
        data.message?.whatsapp === 'Submitted Successfully';

      if (isSuccess) {
        const logId = data.LogID || data.LogId;
        console.log('[AuthkeyWhatsApp] Message sent successfully. LogID:', logId);
        return {
          success: true,
          messageId: logId,
        };
      }

      // Only fail if response body indicates failure
      console.error('[AuthkeyWhatsApp] API error:', data);
      return {
        success: false,
        error: data.Message || data.error || 'Failed to send WhatsApp message',
      };

    } catch (error) {
      console.error('[AuthkeyWhatsApp] Unexpected error:', error);

      // Update message log with error
      if (messageLog) {
        await supabase
          .from('whatsapp_messages')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Network error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', messageLog.id);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send WhatsApp message',
      };
    }
  }

  /**
   * Send OTP code for authentication
   */
  async sendOTP(phone: string, otpCode: string): Promise<SendTemplateResult> {
    return this.sendTemplate({
      phone,
      templateWid: AUTHKEY_TEMPLATES.AUTH_OTP,
      templateName: 'auth_template',
      bodyValues: { '1': otpCode },
    });
  }

  /**
   * Send bid confirmation notification
   */
  async sendBidConfirmation(params: BidConfirmationParams): Promise<SendTemplateResult> {
    const { bidId, phone, bidderName, bidAmount, auctionTitle, modelName } = params;

    return this.sendTemplate({
      phone,
      templateWid: AUTHKEY_TEMPLATES.BID_CONFIRMATION,
      templateName: 'bid_confirmation_1',
      bodyValues: {
        '1': bidderName,
        '2': bidAmount.toString(),
        '3': auctionTitle,
        '4': modelName,
      },
      bidId,
    });
  }
}

// Export singleton instance
export const authkeyWhatsAppService = new AuthkeyWhatsAppService();

// Export class for testing
export { AuthkeyWhatsAppService };
