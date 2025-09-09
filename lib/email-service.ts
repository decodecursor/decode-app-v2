/**
 * Email Service for DECODE Payment Platform
 * 
 * This module handles all email notifications including payment confirmations,
 * receipts, failure notifications, and other system emails.
 */

import { supabase } from './supabase'

// Email service configuration
interface EmailConfig {
  provider: 'resend' | 'sendgrid' | 'mock'
  apiKey: string
  fromEmail: string
  fromName: string
}

// Email templates data interfaces
export interface PaymentConfirmationData {
  buyerEmail: string
  buyerName?: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  serviceDescription?: string
  creatorName: string
  creatorEmail: string
  paymentMethod?: string
  transactionDate: string
  receiptUrl?: string
}

export interface PaymentFailureData {
  buyerEmail: string
  buyerName?: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  failureReason: string
  retryUrl?: string
  supportEmail: string
  failureDate: string
}

export interface PaymentReceiptData {
  buyerEmail: string
  buyerName?: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  serviceDescription?: string
  creatorName: string
  creatorBusinessInfo?: {
    name: string
    address?: string
    taxId?: string
  }
  paymentMethod: string
  transactionDate: string
  fees?: {
    processing: number
    platform: number
  }
  receiptNumber: string
}

export interface UserInvitationData {
  recipientEmail: string
  recipientName: string
  inviterName: string
  companyName: string
  role: string
  signupUrl: string
  inviteDate: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  provider?: string
}

class EmailService {
  private config: EmailConfig

  constructor() {
    const provider = (process.env.EMAIL_PROVIDER as 'resend' | 'sendgrid' | 'mock') || 'mock'
    
    // Get the appropriate API key based on provider
    let apiKey = ''
    if (provider === 'resend') {
      apiKey = process.env.RESEND_API_KEY || ''
    } else if (provider === 'sendgrid') {
      apiKey = process.env.SENDGRID_API_KEY || ''
    }
    
    this.config = {
      provider,
      apiKey,
      fromEmail: process.env.EMAIL_FROM || 'DECODE Beauty <noreply@decode.beauty>',
      fromName: process.env.EMAIL_FROM_NAME || 'DECODE Beauty'
    }
    
    // Log configuration for debugging (without API key)
    console.log(`📧 Email service initialized with provider: ${this.config.provider}`)
    console.log(`📧 From email: ${this.config.fromEmail}`)
    console.log(`📧 API key present: ${this.config.apiKey ? 'YES (length: ' + this.config.apiKey.length + ')' : 'NO'}`)
    console.log(`📧 Environment variables loaded:`)
    console.log(`   - EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER}`)
    console.log(`   - EMAIL_FROM: ${process.env.EMAIL_FROM}`)
    console.log(`   - RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'YES' : 'NO'}`)
  }

  /**
   * Send payment confirmation email to buyer
   */
  async sendPaymentConfirmation(data: PaymentConfirmationData): Promise<EmailResult> {
    try {
      console.log(`📧 Sending payment confirmation email to ${data.buyerEmail}`)

      const subject = `Payment Confirmed - ${data.serviceTitle}`
      
      const emailContent = await this.renderPaymentConfirmationEmail(data)
      
      const result = await this.sendEmail({
        to: data.buyerEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: data.buyerEmail,
        emailType: 'payment_confirmation',
        transactionId: data.transactionId,
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending payment confirmation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send payment failure notification to buyer
   */
  async sendPaymentFailure(data: PaymentFailureData): Promise<EmailResult> {
    try {
      console.log(`📧 Sending payment failure notification to ${data.buyerEmail}`)

      const subject = `Payment Failed - ${data.serviceTitle}`
      
      const emailContent = await this.renderPaymentFailureEmail(data)
      
      const result = await this.sendEmail({
        to: data.buyerEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: data.buyerEmail,
        emailType: 'payment_failed_notification',
        transactionId: data.transactionId,
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending payment failure notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send detailed payment receipt
   */
  async sendPaymentReceipt(data: PaymentReceiptData): Promise<EmailResult> {
    try {
      console.log(`📧 Sending payment receipt to ${data.buyerEmail}`)

      const subject = `Receipt for ${data.serviceTitle} - ${data.receiptNumber}`
      
      const emailContent = await this.renderPaymentReceiptEmail(data)
      
      const result = await this.sendEmail({
        to: data.buyerEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: data.buyerEmail,
        emailType: 'payment_confirmation', // Receipt is a type of confirmation
        transactionId: data.transactionId,
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending payment receipt:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send user invitation email
   */
  async sendUserInvitation(data: UserInvitationData): Promise<EmailResult> {
    try {
      console.log(`📧 Sending user invitation to ${data.recipientEmail}`)

      const subject = `You're invited to join ${data.companyName} on DECODE`
      
      const emailContent = await this.renderUserInvitationEmail(data)
      
      const result = await this.sendEmail({
        to: data.recipientEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: data.recipientEmail,
        emailType: 'user_invitation',
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending user invitation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send notification to creator about successful payment
   */
  async sendCreatorPaymentNotification(data: {
    creatorEmail: string
    creatorName: string
    transactionId: string
    amount: number
    currency: string
    serviceTitle: string
    buyerEmail?: string
    transactionDate: string
  }): Promise<EmailResult> {
    try {
      console.log(`📧 Sending creator notification to ${data.creatorEmail}`)

      const subject = `New Payment Received - ${data.serviceTitle}`
      
      const emailContent = await this.renderCreatorNotificationEmail(data)
      
      const result = await this.sendEmail({
        to: data.creatorEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: data.creatorEmail,
        emailType: 'system_notification',
        transactionId: data.transactionId,
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending creator notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Core email sending function
   */
  private async sendEmail(params: {
    to: string
    subject: string
    html: string
    text: string
    cc?: string[]
    bcc?: string[]
  }): Promise<EmailResult> {
    switch (this.config.provider) {
      case 'resend':
        return this.sendWithResend(params)
      case 'sendgrid':
        return this.sendWithSendGrid(params)
      case 'mock':
      default:
        return this.sendWithMock(params)
    }
  }

  /**
   * Send email using Resend
   */
  private async sendWithResend(params: {
    to: string
    subject: string
    html: string
    text: string
  }): Promise<EmailResult> {
    try {
      console.log(`📧 [RESEND] Starting email send process...`)
      console.log(`📧 [RESEND] To: ${params.to}`)
      console.log(`📧 [RESEND] Subject: ${params.subject}`)
      
      if (!this.config.apiKey) {
        console.error(`📧 [RESEND] ERROR: API key not configured`)
        throw new Error('Resend API key not configured')
      }

      const emailPayload = {
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text
      }
      
      console.log(`📧 [RESEND] From: ${emailPayload.from}`)
      console.log(`📧 [RESEND] Making API call to Resend...`)

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      })

      console.log(`📧 [RESEND] Response status: ${response.status} ${response.statusText}`)
      
      const result = await response.json()
      console.log(`📧 [RESEND] Response body:`, result)

      if (!response.ok) {
        console.error(`📧 [RESEND] API Error:`, result)
        throw new Error(result.message || 'Failed to send email')
      }

      console.log(`📧 [RESEND] SUCCESS: Email sent with ID ${result.id}`)
      return {
        success: true,
        messageId: result.id,
        provider: 'resend'
      }
    } catch (error) {
      console.error(`📧 [RESEND] EXCEPTION:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'resend'
      }
    }
  }

  /**
   * Send email using SendGrid
   */
  private async sendWithSendGrid(params: {
    to: string
    subject: string
    html: string
    text: string
  }): Promise<EmailResult> {
    try {
      if (!this.config.apiKey) {
        throw new Error('SendGrid API key not configured')
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: params.to }],
            subject: params.subject
          }],
          from: {
            email: this.config.fromEmail,
            name: this.config.fromName
          },
          content: [
            {
              type: 'text/plain',
              value: params.text
            },
            {
              type: 'text/html',
              value: params.html
            }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`SendGrid error: ${error}`)
      }

      // SendGrid returns 202 with no body on success
      const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`

      return {
        success: true,
        messageId,
        provider: 'sendgrid'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'sendgrid'
      }
    }
  }

  /**
   * Mock email sending for development/testing
   */
  private async sendWithMock(params: {
    to: string
    subject: string
    html: string
    text: string
  }): Promise<EmailResult> {
    console.log('📧 [MOCK EMAIL]', {
      to: params.to,
      subject: params.subject,
      htmlLength: params.html.length,
      textLength: params.text.length
    })

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      provider: 'mock'
    }
  }

  /**
   * Log email attempt to database
   */
  private async logEmail(data: {
    recipientEmail: string
    emailType: string
    transactionId?: string
    paymentLinkId?: string
    subject: string
    status: string
    emailServiceId?: string
    errorMessage?: string
  }) {
    try {
      // TODO: Uncomment when email_logs table is added to database
      // await supabase.from('email_logs').insert({
      //   recipient_email: data.recipientEmail,
      //   email_type: data.emailType,
      //   transaction_id: data.transactionId || null,
      //   payment_link_id: data.paymentLinkId || null,
      //   subject: data.subject,
      //   status: data.status,
      //   email_service_id: data.emailServiceId || null,
      //   error_message: data.errorMessage || null,
      //   sent_at: data.status === 'sent' ? new Date().toISOString() : null
      // })
      
      // Temporary: Skip database logging until email_logs table is implemented
      console.log('Email log (DB logging disabled):', {
        recipient: data.recipientEmail,
        type: data.emailType,
        status: data.status
      })
    } catch (error) {
      console.error('Error logging email:', error)
      // Don't throw here to avoid breaking email flow
    }
  }

  /**
   * Render payment confirmation email
   */
  private async renderPaymentConfirmationEmail(data: PaymentConfirmationData): Promise<{
    html: string
    text: string
  }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff1744 0%, #e91e63 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-icon { font-size: 48px; color: #4CAF50; margin-bottom: 20px; }
        .amount { font-size: 32px; font-weight: bold; color: #4CAF50; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #ff1744; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <h2>Payment Confirmed!</h2>
        </div>
        <div class="content">
            <div style="text-align: center;">
                <div class="success-icon">✅</div>
                <h3>Thank you for your payment!</h3>
                <div class="amount">$${data.amount.toFixed(2)} ${data.currency}</div>
                <p>Your payment has been successfully processed.</p>
            </div>
            
            <div class="details">
                <h4>Payment Details</h4>
                <div class="detail-row">
                    <span><strong>Service:</strong></span>
                    <span>${data.serviceTitle}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Transaction ID:</strong></span>
                    <span>${data.transactionId}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Date:</strong></span>
                    <span>${new Date(data.transactionDate).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Provider:</strong></span>
                    <span>${data.creatorName}</span>
                </div>
                ${data.paymentMethod ? `
                <div class="detail-row">
                    <span><strong>Payment Method:</strong></span>
                    <span>${data.paymentMethod}</span>
                </div>
                ` : ''}
            </div>
            
            <div style="text-align: center;">
                <p>You will receive your service details from ${data.creatorName} soon.</p>
                ${data.receiptUrl ? `<a href="${data.receiptUrl}" class="button">View Receipt</a>` : ''}
            </div>
        </div>
        <div class="footer">
            <p>This email was sent by DECODE Beauty Platform</p>
            <p>If you have any questions, please contact support.</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Payment Confirmed!

Thank you for your payment!

Amount: $${data.amount.toFixed(2)} ${data.currency}
Service: ${data.serviceTitle}
Transaction ID: ${data.transactionId}
Date: ${new Date(data.transactionDate).toLocaleDateString()}
Provider: ${data.creatorName}
${data.paymentMethod ? `Payment Method: ${data.paymentMethod}` : ''}

You will receive your service details from ${data.creatorName} soon.

${data.receiptUrl ? `View Receipt: ${data.receiptUrl}` : ''}

---
DECODE Beauty Platform
If you have any questions, please contact support.
`

    return { html, text }
  }

  /**
   * Render payment failure email
   */
  private async renderPaymentFailureEmail(data: PaymentFailureData): Promise<{
    html: string
    text: string
  }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Failed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .error-icon { font-size: 48px; color: #f44336; margin-bottom: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #333; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #ff1744; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .error-box { background: #ffebee; border: 1px solid #f44336; border-radius: 5px; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <h2>Payment Failed</h2>
        </div>
        <div class="content">
            <div style="text-align: center;">
                <div class="error-icon">❌</div>
                <h3>We couldn't process your payment</h3>
                <div class="amount">$${data.amount.toFixed(2)} ${data.currency}</div>
            </div>
            
            <div class="error-box">
                <strong>Error:</strong> ${data.failureReason}
            </div>
            
            <div class="details">
                <h4>Payment Details</h4>
                <div class="detail-row">
                    <span><strong>Service:</strong></span>
                    <span>${data.serviceTitle}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Transaction ID:</strong></span>
                    <span>${data.transactionId}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Failed on:</strong></span>
                    <span>${new Date(data.failureDate).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <p>Don't worry - you have not been charged for this failed payment.</p>
                ${data.retryUrl ? `<a href="${data.retryUrl}" class="button">Try Payment Again</a>` : ''}
                <p>If you continue to have issues, please contact support at ${data.supportEmail}</p>
            </div>
        </div>
        <div class="footer">
            <p>This email was sent by DECODE Beauty Platform</p>
            <p>Need help? Contact us at ${data.supportEmail}</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Payment Failed

We couldn't process your payment for ${data.serviceTitle}.

Amount: $${data.amount.toFixed(2)} ${data.currency}
Transaction ID: ${data.transactionId}
Failed on: ${new Date(data.failureDate).toLocaleDateString()}

Error: ${data.failureReason}

Don't worry - you have not been charged for this failed payment.

${data.retryUrl ? `Try payment again: ${data.retryUrl}` : ''}

If you continue to have issues, please contact support at ${data.supportEmail}

---
DECODE Beauty Platform
Need help? Contact us at ${data.supportEmail}
`

    return { html, text }
  }

  /**
   * Render detailed payment receipt
   */
  private async renderPaymentReceiptEmail(data: PaymentReceiptData): Promise<{
    html: string
    text: string
  }> {
    const subtotal = data.amount
    const processingFee = data.fees?.processing || 0
    const platformFee = data.fees?.platform || 0
    const total = subtotal + processingFee + platformFee

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff1744 0%, #e91e63 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .receipt { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ddd; }
        .receipt-header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .total-row { border-top: 2px solid #eee; margin-top: 20px; padding-top: 15px; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <h2>Payment Receipt</h2>
        </div>
        <div class="content">
            <div class="receipt">
                <div class="receipt-header">
                    <h3>Official Receipt</h3>
                    <p><strong>Receipt #:</strong> ${data.receiptNumber}</p>
                    <p><strong>Date:</strong> ${new Date(data.transactionDate).toLocaleDateString()}</p>
                </div>
                
                <div>
                    <h4>Service Details</h4>
                    <div class="detail-row">
                        <span>Service:</span>
                        <span>${data.serviceTitle}</span>
                    </div>
                    ${data.serviceDescription ? `
                    <div class="detail-row">
                        <span>Description:</span>
                        <span>${data.serviceDescription}</span>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <span>Provider:</span>
                        <span>${data.creatorName}</span>
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    <h4>Payment Summary</h4>
                    <div class="detail-row">
                        <span>Subtotal:</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    ${processingFee > 0 ? `
                    <div class="detail-row">
                        <span>Processing Fee:</span>
                        <span>$${processingFee.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${platformFee > 0 ? `
                    <div class="detail-row">
                        <span>Platform Fee:</span>
                        <span>$${platformFee.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="detail-row total-row">
                        <span>Total Paid:</span>
                        <span>$${total.toFixed(2)} ${data.currency}</span>
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    <h4>Payment Information</h4>
                    <div class="detail-row">
                        <span>Transaction ID:</span>
                        <span>${data.transactionId}</span>
                    </div>
                    <div class="detail-row">
                        <span>Payment Method:</span>
                        <span>${data.paymentMethod}</span>
                    </div>
                </div>
                
                ${data.creatorBusinessInfo ? `
                <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    <h4>Service Provider</h4>
                    <p>${data.creatorBusinessInfo.name}</p>
                    ${data.creatorBusinessInfo.address ? `<p>${data.creatorBusinessInfo.address}</p>` : ''}
                    ${data.creatorBusinessInfo.taxId ? `<p>Tax ID: ${data.creatorBusinessInfo.taxId}</p>` : ''}
                </div>
                ` : ''}
            </div>
            
            <p style="text-align: center; color: #666;">
                Please keep this receipt for your records.
            </p>
        </div>
        <div class="footer">
            <p>This receipt was generated by DECODE Beauty Platform</p>
            <p>For support, please contact us with your transaction ID.</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Payment Receipt

Receipt #: ${data.receiptNumber}
Date: ${new Date(data.transactionDate).toLocaleDateString()}

SERVICE DETAILS
Service: ${data.serviceTitle}
${data.serviceDescription ? `Description: ${data.serviceDescription}` : ''}
Provider: ${data.creatorName}

PAYMENT SUMMARY
Subtotal: $${subtotal.toFixed(2)}
${processingFee > 0 ? `Processing Fee: $${processingFee.toFixed(2)}` : ''}
${platformFee > 0 ? `Platform Fee: $${platformFee.toFixed(2)}` : ''}
Total Paid: $${total.toFixed(2)} ${data.currency}

PAYMENT INFORMATION
Transaction ID: ${data.transactionId}
Payment Method: ${data.paymentMethod}

${data.creatorBusinessInfo ? `
SERVICE PROVIDER
${data.creatorBusinessInfo.name}
${data.creatorBusinessInfo.address || ''}
${data.creatorBusinessInfo.taxId ? `Tax ID: ${data.creatorBusinessInfo.taxId}` : ''}
` : ''}

Please keep this receipt for your records.

---
DECODE Beauty Platform
For support, please contact us with your transaction ID.
`

    return { html, text }
  }

  /**
   * Render creator notification email
   */
  private async renderCreatorNotificationEmail(data: {
    creatorEmail: string
    creatorName: string
    transactionId: string
    amount: number
    currency: string
    serviceTitle: string
    buyerEmail?: string
    transactionDate: string
  }): Promise<{
    html: string
    text: string
  }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Payment Received</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-icon { font-size: 48px; color: #4CAF50; margin-bottom: 20px; }
        .amount { font-size: 32px; font-weight: bold; color: #4CAF50; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <h2>💰 New Payment Received!</h2>
        </div>
        <div class="content">
            <div style="text-align: center;">
                <div class="success-icon">🎉</div>
                <h3>Congratulations, ${data.creatorName}!</h3>
                <div class="amount">+$${data.amount.toFixed(2)} ${data.currency}</div>
                <p>You've received a new payment for your service.</p>
            </div>
            
            <div class="details">
                <h4>Payment Details</h4>
                <div class="detail-row">
                    <span><strong>Service:</strong></span>
                    <span>${data.serviceTitle}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Amount:</strong></span>
                    <span>$${data.amount.toFixed(2)} ${data.currency}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Transaction ID:</strong></span>
                    <span>${data.transactionId}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Date:</strong></span>
                    <span>${new Date(data.transactionDate).toLocaleDateString()}</span>
                </div>
                ${data.buyerEmail ? `
                <div class="detail-row">
                    <span><strong>Customer:</strong></span>
                    <span>${data.buyerEmail}</span>
                </div>
                ` : ''}
            </div>
            
            <div style="text-align: center;">
                <p>The payment has been processed successfully and will be deposited according to your payout schedule.</p>
                <a href="#" class="button">View Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>This notification was sent by DECODE Beauty Platform</p>
            <p>Manage your payment settings in your dashboard.</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - New Payment Received!

Congratulations, ${data.creatorName}!

You've received a new payment: +$${data.amount.toFixed(2)} ${data.currency}

PAYMENT DETAILS
Service: ${data.serviceTitle}
Amount: $${data.amount.toFixed(2)} ${data.currency}
Transaction ID: ${data.transactionId}
Date: ${new Date(data.transactionDate).toLocaleDateString()}
${data.buyerEmail ? `Customer: ${data.buyerEmail}` : ''}

The payment has been processed successfully and will be deposited according to your payout schedule.

---
DECODE Beauty Platform
Manage your payment settings in your dashboard.
`

    return { html, text }
  }

  /**
   * Render user invitation email
   */
  private async renderUserInvitationEmail(data: UserInvitationData): Promise<{
    html: string
    text: string
  }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${data.companyName} on DECODE</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #34d399 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .invite-icon { font-size: 48px; color: #34d399; margin-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #059669; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #34d399; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .button:hover { background: #059669; }
        .expiry-notice { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 20px 0; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <h2>🎉 You're Invited!</h2>
        </div>
        <div class="content">
            <div style="text-align: center;">
                <div class="invite-icon">✉️</div>
                <h3>Hello ${data.recipientName}!</h3>
                <div class="company-name">${data.companyName}</div>
                <p>You've been invited to join <strong>${data.companyName}</strong> on the DECODE Beauty Platform.</p>
            </div>
            
            <div class="details">
                <h4>Invitation Details</h4>
                <div class="detail-row">
                    <span><strong>Company:</strong></span>
                    <span>${data.companyName}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Role:</strong></span>
                    <span>${data.role}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Invited by:</strong></span>
                    <span>${data.inviterName}</span>
                </div>
                <div class="detail-row">
                    <span><strong>Date:</strong></span>
                    <span>${new Date(data.inviteDate).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="expiry-notice">
                ⏰ <strong>Important:</strong> This invitation will expire in 48 hours. Please accept it soon to join your team.
            </div>
            
            <div style="text-align: center;">
                <p>Click the button below to create your account and join ${data.companyName}.</p>
                <a href="${data.signupUrl}" class="button">Accept Invitation & Sign Up</a>
                <p style="font-size: 14px; color: #666;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${data.signupUrl}" style="color: #059669; word-break: break-all;">${data.signupUrl}</a>
                </p>
            </div>
        </div>
        <div class="footer">
            <p>This invitation was sent by DECODE Beauty Platform</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - You're Invited to Join ${data.companyName}!

Hello ${data.recipientName}!

You've been invited to join ${data.companyName} on the DECODE Beauty Platform.

INVITATION DETAILS
Company: ${data.companyName}
Role: ${data.role}
Invited by: ${data.inviterName}
Date: ${new Date(data.inviteDate).toLocaleDateString()}

IMPORTANT: This invitation will expire in 48 hours.

To accept this invitation and create your account, visit:
${data.signupUrl}

If you didn't expect this invitation, you can safely ignore this email.

---
DECODE Beauty Platform
`

    return { html, text }
  }
}

// Export singleton instance
export const emailService = new EmailService()

// Export types and interfaces
export type { EmailConfig }