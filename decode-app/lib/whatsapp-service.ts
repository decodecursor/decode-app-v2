/**
 * WhatsApp Business API Service
 *
 * Handles sending OTP codes via WhatsApp Cloud API for authentication.
 * Requires Meta WhatsApp Business Account with approved message template.
 */

interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
  apiVersion: string
  templateName: string
}

interface SendOTPResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * WhatsApp Service Class
 * Handles all WhatsApp Business API interactions
 */
class WhatsAppService {
  private config: WhatsAppConfig

  constructor() {
    // Load configuration from environment variables
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
      templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'decode_login_otp'
    }

    // Validate configuration
    if (!this.config.phoneNumberId || !this.config.accessToken) {
      console.error('❌ [WhatsApp] Missing required configuration')
    }
  }

  /**
   * Send OTP code to a phone number via WhatsApp
   * @param phoneNumber - Phone number in E.164 format (e.g., +971501234567)
   * @param otpCode - 6-digit OTP code
   * @returns Promise with success status and message ID
   */
  async sendOTP(phoneNumber: string, otpCode: string): Promise<SendOTPResponse> {
    try {
      // Validate inputs
      if (!this.validatePhoneNumber(phoneNumber)) {
        return {
          success: false,
          error: 'Invalid phone number format. Use E.164 format (e.g., +971501234567)'
        }
      }

      if (!this.validateOTP(otpCode)) {
        return {
          success: false,
          error: 'Invalid OTP code. Must be 6 digits.'
        }
      }

      // Construct WhatsApp API request
      const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`

      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: this.config.templateName,
          language: {
            code: 'en' // English template
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: otpCode
                }
              ]
            }
          ]
        }
      }

      console.log('📱 [WhatsApp] Sending OTP to:', phoneNumber.substring(0, 7) + '****')

      // Send request to WhatsApp API
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.accessToken}`
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ [WhatsApp] API error:', data)

        // Handle specific WhatsApp errors
        if (data.error?.code === 131026) {
          return {
            success: false,
            error: 'Message template not found or not approved. Please check Meta Business Manager.'
          }
        } else if (data.error?.code === 131047) {
          return {
            success: false,
            error: 'Re-engagement message. User must message you first within 24 hours.'
          }
        } else if (data.error?.code === 100) {
          return {
            success: false,
            error: 'Invalid phone number or number not on WhatsApp.'
          }
        }

        return {
          success: false,
          error: data.error?.message || 'Failed to send WhatsApp message'
        }
      }

      console.log('✅ [WhatsApp] OTP sent successfully. Message ID:', data.messages?.[0]?.id)

      return {
        success: true,
        messageId: data.messages?.[0]?.id
      }

    } catch (error: any) {
      console.error('❌ [WhatsApp] Unexpected error:', error)
      return {
        success: false,
        error: error.message || 'Failed to send WhatsApp OTP'
      }
    }
  }

  /**
   * Validate phone number format (E.164)
   * @param phoneNumber - Phone number to validate
   * @returns True if valid
   */
  private validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[country code][number]
    // Example: +971501234567
    const e164Regex = /^\+[1-9]\d{1,14}$/
    return e164Regex.test(phoneNumber)
  }

  /**
   * Validate OTP code format
   * @param otpCode - OTP code to validate
   * @returns True if valid
   */
  private validateOTP(otpCode: string): boolean {
    // Must be exactly 6 digits
    return /^\d{6}$/.test(otpCode)
  }

  /**
   * Generate a random 6-digit OTP code
   * @returns 6-digit numeric string
   */
  static generateOTP(): string {
    // Generate 6-digit code (100000 to 999999)
    const otp = Math.floor(100000 + Math.random() * 900000)
    return otp.toString()
  }

  /**
   * Check if WhatsApp service is properly configured
   * @returns True if all required config is present
   */
  isConfigured(): boolean {
    return !!(
      this.config.phoneNumberId &&
      this.config.accessToken &&
      this.config.templateName
    )
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService()

// Export class for testing
export { WhatsAppService }

// Export types
export type { SendOTPResponse }
