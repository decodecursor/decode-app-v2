/**
 * WhatsApp Service
 *
 * Handles sending OTP codes via AUTHKEY BSP for authentication.
 * Migrated from Meta WhatsApp Cloud API to AUTHKEY.
 */

import { authkeyWhatsAppService } from '@/lib/services/AuthkeyWhatsAppService';

interface SendOTPResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * WhatsApp Service Class
 * Wrapper around AuthkeyWhatsAppService for backward compatibility
 */
class WhatsAppService {
  constructor() {
    if (!authkeyWhatsAppService.isConfigured()) {
      console.error('[WhatsApp] Missing AUTHKEY_API_KEY configuration')
    }
  }

  /**
   * Send OTP code to a phone number via WhatsApp (AUTHKEY)
   * @param phoneNumber - Phone number in E.164 format (e.g., +971501234567)
   * @param otpCode - 6-digit OTP code
   * @returns Promise with success status and message ID
   */
  async sendOTP(phoneNumber: string, otpCode: string): Promise<SendOTPResponse> {
    // Validate OTP format
    if (!this.validateOTP(otpCode)) {
      return {
        success: false,
        error: 'Invalid OTP code. Must be 6 digits.'
      }
    }

    console.log('[WhatsApp] Sending OTP via AUTHKEY to:', phoneNumber.substring(0, 7) + '****')

    const result = await authkeyWhatsAppService.sendOTP(phoneNumber, otpCode)

    if (result.success) {
      console.log('[WhatsApp] OTP sent successfully. Message ID:', result.messageId)
    } else {
      console.error('[WhatsApp] Failed to send OTP:', result.error)
    }

    return result
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
   * @returns True if AUTHKEY is configured
   */
  isConfigured(): boolean {
    return authkeyWhatsAppService.isConfigured()
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService()

// Export class for testing
export { WhatsAppService }

// Export types
export type { SendOTPResponse }
