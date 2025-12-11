/**
 * Email Service for DECODE Payment Platform
 * 
 * This module handles all email notifications including payment confirmations,
 * receipts, failure notifications, and other system emails.
 */

// Database logging temporarily disabled - no supabase import needed for now

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
  invitedBy: string
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
    
    // Clean up fromEmail format
    const fromEmailRaw = process.env.EMAIL_FROM || 'DECODE <noreply@welovedecode.com>'
    const fromName = process.env.EMAIL_FROM_NAME || 'DECODE'
    
    this.config = {
      provider,
      apiKey,
      fromEmail: fromEmailRaw,
      fromName
    }
    
    // Enhanced logging for debugging
    console.log(`📧 [EMAIL SERVICE INIT] Email service initialized with provider: ${this.config.provider}`)
    console.log(`📧 [EMAIL SERVICE INIT] From email: ${this.config.fromEmail}`)
    console.log(`📧 [EMAIL SERVICE INIT] From name: ${this.config.fromName}`)
    console.log(`📧 [EMAIL SERVICE INIT] API key present: ${this.config.apiKey ? 'YES (length: ' + this.config.apiKey.length + ')' : 'NO'}`)
    console.log(`📧 [EMAIL SERVICE INIT] Environment variables:`)
    console.log(`   - EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER}`)
    console.log(`   - EMAIL_FROM: ${process.env.EMAIL_FROM}`)
    console.log(`   - EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME}`)
    console.log(`   - RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'YES' : 'NO'}`)
    console.log(`   - NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL}`)
    
    // Validate API key format for Resend
    if (this.config.provider === 'resend' && this.config.apiKey) {
      if (!this.config.apiKey.startsWith('re_')) {
        console.error(`📧 [EMAIL SERVICE INIT] ❌ CRITICAL: Resend API key format is invalid!`)
        console.error(`📧 [EMAIL SERVICE INIT] Expected to start with 're_' but got: ${this.config.apiKey.substring(0, 10)}...`)
        console.error(`📧 [EMAIL SERVICE INIT] This will cause all email sending to fail.`)
      } else {
        console.log(`📧 [EMAIL SERVICE INIT] ✅ Resend API key format is valid`)
      }
    }
    
    // Validate fromEmail format
    if (this.config.fromEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const extractedEmail = this.config.fromEmail.match(/<(.+?)>/) ? 
        this.config.fromEmail.match(/<(.+?)>/)![1] : this.config.fromEmail
      
      if (!emailRegex.test(extractedEmail)) {
        console.error(`📧 [EMAIL SERVICE INIT] ❌ CRITICAL: fromEmail format is invalid: ${this.config.fromEmail}`)
      } else {
        console.log(`📧 [EMAIL SERVICE INIT] ✅ fromEmail format is valid: ${extractedEmail}`)
      }
    }
  }

  /**
   * Send payment confirmation email to buyer
   * DISABLED - Only admin emails to sebastian@welovedecode.com are active
   */
  async sendPaymentConfirmation(data: PaymentConfirmationData): Promise<EmailResult> {
    return { success: true, messageId: 'disabled', provider: 'disabled' }; // Email disabled
    /* DISABLED
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
    */ // END DISABLED
  }

  /**
   * Send payment failure notification to buyer
   * DISABLED - Only admin emails to sebastian@welovedecode.com are active
   */
  async sendPaymentFailure(data: PaymentFailureData): Promise<EmailResult> {
    return { success: true, messageId: 'disabled', provider: 'disabled' }; // Email disabled
    /* DISABLED
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
    */ // END DISABLED
  }

  /**
   * Send detailed payment receipt
   * DISABLED - Only admin emails to sebastian@welovedecode.com are active
   */
  async sendPaymentReceipt(data: PaymentReceiptData): Promise<EmailResult> {
    return { success: true, messageId: 'disabled', provider: 'disabled' }; // Email disabled
    /* DISABLED
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
    */ // END DISABLED
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
   * Main method to send invitation email - delegates to sendUserInvitation
   */
  async sendInvitation(data: {
    to: string
    companyName: string
    role: string
    signupUrl: string
    invitedBy: string
  }): Promise<EmailResult> {
    return this.sendUserInvitation({
      recipientEmail: data.to,
      recipientName: '',
      inviterName: data.invitedBy,
      companyName: data.companyName,
      role: data.role,
      signupUrl: data.signupUrl,
      inviteDate: new Date().toISOString(),
      invitedBy: data.invitedBy
    })
  }

  /**
   * Send notification to creator about successful payment
   * DISABLED - Only admin emails to sebastian@welovedecode.com are active
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
    // Email disabled - only admin notifications to sebastian@welovedecode.com are active
    return { success: true, messageId: 'disabled', provider: 'disabled' };
    /* DISABLED
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
    */
  }

  /**
   * Generic send method for custom emails (e.g., auction notifications)
   */
  async send(params: {
    to: string
    subject: string
    html: string
    text?: string
    cc?: string[]
    bcc?: string[]
  }): Promise<EmailResult> {
    return this.sendEmail({
      ...params,
      text: params.text || params.html.replace(/<[^>]*>/g, ''), // Strip HTML as fallback
    });
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
      console.log(`📧 [RESEND] ====== Starting email send process ======`)
      console.log(`📧 [RESEND] To: ${params.to}`)
      console.log(`📧 [RESEND] Subject: ${params.subject}`)
      console.log(`📧 [RESEND] HTML length: ${params.html.length} chars`)
      console.log(`📧 [RESEND] Text length: ${params.text.length} chars`)
      
      // Validate API key
      if (!this.config.apiKey) {
        console.error(`📧 [RESEND] ❌ CRITICAL: API key not configured`)
        throw new Error('Resend API key not configured')
      }
      
      if (!this.config.apiKey.startsWith('re_')) {
        console.error(`📧 [RESEND] ❌ CRITICAL: API key format invalid (should start with 're_')`)
        console.error(`📧 [RESEND] Current API key starts with: ${this.config.apiKey.substring(0, 10)}...`)
        throw new Error('Resend API key format is invalid')
      }

      // Format the from email properly
      let fromEmailFormatted: string
      if (this.config.fromEmail.includes('<')) {
        fromEmailFormatted = this.config.fromEmail
      } else {
        // Extract email if it's just the email address
        const emailMatch = this.config.fromEmail.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/)
        if (emailMatch) {
          fromEmailFormatted = `${this.config.fromName} <${emailMatch[1]}>`
        } else {
          fromEmailFormatted = `${this.config.fromName} <${this.config.fromEmail}>`
        }
      }
      
      // Validate recipient email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(params.to)) {
        console.error(`📧 [RESEND] ❌ CRITICAL: Recipient email format is invalid: ${params.to}`)
        throw new Error(`Invalid recipient email format: ${params.to}`)
      }
      
      const emailPayload = {
        from: fromEmailFormatted,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text
      }
      
      console.log(`📧 [RESEND] From: ${emailPayload.from}`)
      console.log(`📧 [RESEND] Payload prepared, making API call to Resend...`)
      console.log(`📧 [RESEND] API URL: https://api.resend.com/emails`)
      console.log(`📧 [RESEND] Auth header: Bearer ${this.config.apiKey.substring(0, 10)}...`)

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      })

      console.log(`📧 [RESEND] Response received - Status: ${response.status} ${response.statusText}`)
      console.log(`📧 [RESEND] Response headers:`, Object.fromEntries(response.headers.entries()))
      
      let result: any
      try {
        result = await response.json()
        console.log(`📧 [RESEND] Response body:`, JSON.stringify(result, null, 2))
      } catch (parseError) {
        console.error(`📧 [RESEND] ❌ Failed to parse response JSON:`, parseError)
        const textResult = await response.text()
        console.log(`📧 [RESEND] Raw response text:`, textResult)
        throw new Error(`Invalid JSON response from Resend API: ${textResult}`)
      }

      if (!response.ok) {
        console.error(`📧 [RESEND] ❌ API Error - Status ${response.status}:`, result)
        
        // Provide specific error messages based on common Resend errors
        let errorMessage = result.message || `Resend API error (${response.status})`
        
        if (response.status === 401) {
          errorMessage = 'Invalid or expired Resend API key'
        } else if (response.status === 403) {
          errorMessage = 'Domain not verified or sending not allowed'
        } else if (response.status === 422) {
          errorMessage = 'Invalid email data or format'
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded - try again later'
        }
        
        throw new Error(errorMessage)
      }

      console.log(`📧 [RESEND] ✅ SUCCESS: Email sent with ID ${result.id}`)
      console.log(`📧 [RESEND] ====== Email send completed ======`)
      return {
        success: true,
        messageId: result.id,
        provider: 'resend'
      }
    } catch (error) {
      console.error(`📧 [RESEND] ❌ EXCEPTION occurred:`, error)
      console.error(`📧 [RESEND] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; color: #6366f1; margin-bottom: 30px; }
        .company-name { font-size: 24px; font-weight: bold; color: #059669; margin: 20px 0; }
        .button { display: inline-block; background: #34d399; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .expiry { color: #666; font-size: 14px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <p>Hello</p>

        <p>You've been invited to join ${data.companyName} on DECODE.</p>

        <div class="company-name">${data.companyName}</div>

        <a href="${data.signupUrl}" class="button">Accept Invitation & Register</a>

        <div class="expiry">Invitation expires in 48 hours</div>
    </div>
</body>
</html>`

    const text = `
Hello

You've been invited to join ${data.companyName} on DECODE.

${data.companyName}

Accept invitation: ${data.signupUrl}

Invitation expires in 48 hours

---
DECODE
`

    return { html, text }
  }

  /**
   * Send admin notification for new user registration
   */
  async sendAdminUserRegistrationNotification(userData: {
    id: string
    email: string
    user_name: string
    role: string
    company_name?: string
    branch_name?: string
    approval_status?: string
    invited_by?: string
    created_at: string
  }): Promise<EmailResult> {
    try {
      const adminEmail = 'sebastian@welovedecode.com'
      const subject = `🆕 New Registration - ${userData.role} - ${userData.user_name}`

      const emailContent = await this.renderAdminUserRegistrationEmail(userData)

      const result = await this.sendEmail({
        to: adminEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: adminEmail,
        emailType: 'admin_user_registration',
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending admin user registration notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send admin notification for successful payment
   */
  async sendAdminPaymentNotification(paymentData: {
    payment_link_id: string
    paymentlink_request_id?: string
    transaction_id: string
    service_amount_aed: number
    decode_amount_aed?: number
    total_amount_aed: number
    platform_fee?: number
    company_name: string
    staff_name?: string
    branch_name?: string
    client_name: string
    client_email?: string
    client_phone?: string
    service_name?: string
    service_description?: string
    payment_method?: string
    payment_processor?: string
    processor_transaction_id?: string
    completed_at: string
  }): Promise<EmailResult> {
    try {
      const adminEmail = 'sebastian@welovedecode.com'
      const subject = `💰 Payment Received - ${paymentData.company_name} - ${paymentData.total_amount_aed} AED`

      const emailContent = await this.renderAdminPaymentNotificationEmail(paymentData)

      const result = await this.sendEmail({
        to: adminEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: adminEmail,
        emailType: 'admin_payment_notification',
        transactionId: paymentData.transaction_id,
        paymentLinkId: paymentData.payment_link_id,
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending admin payment notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send admin notification for payout request
   */
  async sendAdminPayoutRequestNotification(payoutData: {
    payout_request_id?: string
    user_name: string
    user_email: string
    user_role: string
    user_id: string
    company_name: string
    branch_name?: string
    amount: number
    total_earnings?: number
    available_balance?: number
    previous_payouts_count?: number
    preferred_payout_method?: string
    beneficiary_name?: string
    bank_name?: string
    account_type?: string
    iban_number?: string
    stripe_connect_account_id?: string
    paypal_email?: string
    paypal_account_type?: string
    last_payout_date?: string
    last_payout_amount?: number
    request_date: string
    auction_ids?: string[]
    auction_titles?: string[]
    auction_amounts?: number[]
  }): Promise<EmailResult> {
    try {
      const adminEmail = 'sebastian@welovedecode.com'
      const subject = `💸 Payout Request – ${payoutData.user_name} - ${payoutData.amount} AED`

      const emailContent = await this.renderAdminPayoutRequestEmail(payoutData)

      const result = await this.sendEmail({
        to: adminEmail,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      // Log email attempt
      await this.logEmail({
        recipientEmail: adminEmail,
        emailType: 'admin_payout_request',
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending admin payout request notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send auction completed notification to model
   */
  async sendModelAuctionCompletedEmail(data: {
    model_email: string
    model_name: string
    auction_id: string
    auction_title: string
    winning_bid_amount: number
    winner_name: string
    auction_start_price: number
    platform_fee: number
    model_payout: number
    dashboard_url: string
  }): Promise<EmailResult> {
    try {
      console.log(`📧 Sending auction completed email to model ${data.model_email}`)

      const subject = `🎉 Your Beauty Auction "${data.auction_title}" Completed Successfully`

      const emailContent = await this.renderModelAuctionCompletedEmail(data)

      const result = await this.sendEmail({
        to: data.model_email,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      await this.logEmail({
        recipientEmail: data.model_email,
        emailType: 'model_auction_completed',
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending model auction completed email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send video uploaded notification to model
   */
  async sendModelVideoUploadedEmail(data: {
    model_email: string
    model_name: string
    auction_id: string
    auction_title: string
    winner_name: string
    video_uploaded_at: string
    dashboard_url: string
  }): Promise<EmailResult> {
    try {
      console.log(`📧 Sending video uploaded email to model ${data.model_email}`)

      const subject = `📹 Winner Video Uploaded`

      const emailContent = await this.renderModelVideoUploadedEmail(data)

      const result = await this.sendEmail({
        to: data.model_email,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      await this.logEmail({
        recipientEmail: data.model_email,
        emailType: 'model_video_uploaded',
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending model video uploaded email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send payout request confirmation to model
   */
  async sendModelPayoutRequestConfirmedEmail(data: {
    model_email: string
    model_name: string
    payout_request_id: string
    payout_amount: number
    payout_method: string
    request_date: string
    dashboard_url: string
    support_email: string
  }): Promise<EmailResult> {
    try {
      console.log(`📧 Sending payout request confirmed email to model ${data.model_email}`)

      const subject = `💰 Payout Request Processing - ${data.payout_request_id}`

      const emailContent = await this.renderModelPayoutRequestConfirmedEmail(data)

      const result = await this.sendEmail({
        to: data.model_email,
        subject,
        html: emailContent.html,
        text: emailContent.text
      })

      await this.logEmail({
        recipientEmail: data.model_email,
        emailType: 'model_payout_confirmed',
        subject,
        status: result.success ? 'sent' : 'failed',
        emailServiceId: result.messageId,
        errorMessage: result.error
      })

      return result
    } catch (error) {
      console.error('Error sending model payout confirmed email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Render admin user registration notification email
   */
  private async renderAdminUserRegistrationEmail(userData: {
    id: string
    email: string
    user_name: string
    role: string
    company_name?: string
    branch_name?: string
    approval_status?: string
    invited_by?: string
    created_at: string
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
    <title>New User Registration</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .header h1 { color: #6366f1; margin: 0; }
        .content { margin-bottom: 30px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .details h3 { margin-top: 0; color: #495057; }
        .footer { text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        .action-btn { display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <p>Administrative Notification</p>
        </div>
        <div class="content">
            <h2>🆕 New User Registration</h2>
            <p>A new user has registered on the DECODE Beauty Platform:</p>

            <div class="details">
                <h3>👤 User Details</h3>
                <p><strong>Name:</strong> ${userData.user_name}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Role:</strong> ${userData.role}</p>
                <p><strong>Company:</strong> ${userData.company_name || 'Not specified'}</p>
                <p><strong>Branch:</strong> ${userData.branch_name || 'Not specified'}</p>
                <p><strong>Registration Date:</strong> ${new Date(userData.created_at).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</p>
                <p><strong>Approval Status:</strong> ${userData.approval_status || 'Pending'}</p>
            </div>

            <div class="details">
                <h3>📋 Additional Information</h3>
                <p><strong>User ID:</strong> ${userData.id}</p>
                <p><strong>Invited By:</strong> ${userData.invited_by || 'Direct registration'}</p>
            </div>

            ${userData.approval_status === 'pending' ? `
                <div class="details">
                    <h3>⚡ Action Required</h3>
                    <p>This user requires approval before they can access the platform.</p>
                    <a href="https://decode-app.vercel.app/dashboard/users" class="action-btn">Review Users →</a>
                </div>
            ` : ''}
        </div>
        <div class="footer">
            <p>This is an automated notification from DECODE Beauty Platform</p>
            <p>Generated at: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })} UAE Time</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE Beauty Platform - New User Registration

A new user has registered:

USER DETAILS
Name: ${userData.user_name}
Email: ${userData.email}
Role: ${userData.role}
Company: ${userData.company_name || 'Not specified'}
Branch: ${userData.branch_name || 'Not specified'}
Registration Date: ${new Date(userData.created_at).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}
Approval Status: ${userData.approval_status || 'Pending'}

ADDITIONAL INFORMATION
User ID: ${userData.id}
Invited By: ${userData.invited_by || 'Direct registration'}

${userData.approval_status === 'pending' ? 'ACTION REQUIRED: This user requires approval - Review at: https://decode-app.vercel.app/dashboard/users' : ''}

---
DECODE Beauty Platform
Generated at: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })} UAE Time
`

    return { html, text }
  }

  /**
   * Render admin payment notification email
   */
  private async renderAdminPaymentNotificationEmail(paymentData: {
    payment_link_id: string
    paymentlink_request_id?: string
    transaction_id: string
    service_amount_aed: number
    decode_amount_aed?: number
    total_amount_aed: number
    platform_fee?: number
    company_name: string
    staff_name?: string
    branch_name?: string
    client_name: string
    client_email?: string
    client_phone?: string
    service_name?: string
    service_description?: string
    payment_method?: string
    payment_processor?: string
    processor_transaction_id?: string
    completed_at: string
  }): Promise<{
    html: string
    text: string
  }> {
    const netAmount = paymentData.total_amount_aed - (paymentData.platform_fee || 0)

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Received</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .header h1 { color: #6366f1; margin: 0; }
        .content { margin-bottom: 30px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .details h3 { margin-top: 0; color: #495057; }
        .footer { text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        .action-btn { display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <p>Administrative Notification</p>
        </div>
        <div class="content">
            <h2>💰 Payment Successfully Processed</h2>
            <p>A payment has been successfully processed on the DECODE Beauty Platform:</p>

            <div class="details">
                <h3>💳 Transaction Details</h3>
                <p><strong>Payment Link ID:</strong> ${paymentData.payment_link_id}</p>
                ${paymentData.paymentlink_request_id ? `<p><strong>Payment Link Request ID:</strong> ${paymentData.paymentlink_request_id}</p>` : ''}
                <p><strong>Transaction ID:</strong> ${paymentData.transaction_id}</p>
                <p><strong>Service Amount:</strong> ${paymentData.service_amount_aed} AED</p>
                <p><strong>DECODE Fee:</strong> ${paymentData.decode_amount_aed || 0} AED</p>
                <p><strong>Total Amount:</strong> ${paymentData.total_amount_aed} AED</p>
                <p><strong>Platform Fee:</strong> ${paymentData.platform_fee || 0} AED</p>
                <p><strong>Net Amount:</strong> ${netAmount} AED</p>
            </div>

            <div class="details">
                <h3>🏢 Business Details</h3>
                <p><strong>Company:</strong> ${paymentData.company_name}</p>
                <p><strong>Staff Member:</strong> ${paymentData.staff_name || 'Not specified'}</p>
                <p><strong>Branch:</strong> ${paymentData.branch_name || 'Not specified'}</p>
            </div>

            <div class="details">
                <h3>👤 Client Details</h3>
                <p><strong>Client Name:</strong> ${paymentData.client_name}</p>
                <p><strong>Client Email:</strong> ${paymentData.client_email || 'Not provided'}</p>
                <p><strong>Client Phone:</strong> ${paymentData.client_phone || 'Not provided'}</p>
            </div>

            <div class="details">
                <h3>💼 Service Details</h3>
                <p><strong>Service:</strong> ${paymentData.service_name || 'Not specified'}</p>
                <p><strong>Description:</strong> ${paymentData.service_description || 'Not provided'}</p>
            </div>

            <div class="details">
                <h3>💳 Payment Information</h3>
                <p><strong>Payment Method:</strong> ${paymentData.payment_method || 'Not specified'}</p>
                <p><strong>Payment Date:</strong> ${new Date(paymentData.completed_at).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</p>
                <p><strong>Payment Processor:</strong> ${paymentData.payment_processor || 'Unknown'}</p>
                <p><strong>Processor Transaction ID:</strong> ${paymentData.processor_transaction_id || 'Not available'}</p>
            </div>

            <a href="https://decode-app.vercel.app/dashboard/payments" class="action-btn">View All Payments →</a>
        </div>
        <div class="footer">
            <p>This is an automated notification from DECODE Beauty Platform</p>
            <p>Generated at: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })} UAE Time</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE Beauty Platform - Payment Received

A payment has been successfully processed:

TRANSACTION DETAILS
Payment Link ID: ${paymentData.payment_link_id}
${paymentData.paymentlink_request_id ? `Payment Link Request ID: ${paymentData.paymentlink_request_id}` : ''}
Transaction ID: ${paymentData.transaction_id}
Service Amount: ${paymentData.service_amount_aed} AED
DECODE Fee: ${paymentData.decode_amount_aed || 0} AED
Total Amount: ${paymentData.total_amount_aed} AED
Platform Fee: ${paymentData.platform_fee || 0} AED
Net Amount: ${netAmount} AED

BUSINESS DETAILS
Company: ${paymentData.company_name}
Staff Member: ${paymentData.staff_name || 'Not specified'}
Branch: ${paymentData.branch_name || 'Not specified'}

CLIENT DETAILS
Client Name: ${paymentData.client_name}
Client Email: ${paymentData.client_email || 'Not provided'}
Client Phone: ${paymentData.client_phone || 'Not provided'}

SERVICE DETAILS
Service: ${paymentData.service_name || 'Not specified'}
Description: ${paymentData.service_description || 'Not provided'}

PAYMENT INFORMATION
Payment Method: ${paymentData.payment_method || 'Not specified'}
Payment Date: ${new Date(paymentData.completed_at).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}
Payment Processor: ${paymentData.payment_processor || 'Unknown'}
Processor Transaction ID: ${paymentData.processor_transaction_id || 'Not available'}

View all payments: https://decode-app.vercel.app/dashboard/payments

---
DECODE Beauty Platform
Generated at: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })} UAE Time
`

    return { html, text }
  }

  /**
   * Render admin payout request notification email
   */
  private async renderAdminPayoutRequestEmail(payoutData: {
    payout_request_id?: string
    user_name: string
    user_email: string
    user_role: string
    user_id: string
    company_name: string
    branch_name?: string
    amount: number
    total_earnings?: number
    available_balance?: number
    previous_payouts_count?: number
    preferred_payout_method?: string
    beneficiary_name?: string
    bank_name?: string
    account_type?: string
    iban_number?: string
    stripe_connect_account_id?: string
    paypal_email?: string
    paypal_account_type?: string
    last_payout_date?: string
    last_payout_amount?: number
    request_date: string
    auction_ids?: string[]
    auction_titles?: string[]
    auction_amounts?: number[]
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
    <title>Payout Request</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .header h1 { color: #6366f1; margin: 0; }
        .content { margin-bottom: 30px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .details h3 { margin-top: 0; color: #495057; }
        .footer { text-align: center; font-size: 12px; color: #666; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        .action-btn { display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <p>Administrative Notification</p>
        </div>
        <div class="content">
            <h2>💸 New Payout Request</h2>

            <div class="details">
                <h3>📋 Request Details</h3>
                <p><strong>Request ID:</strong> ${payoutData.payout_request_id || 'Pending'}</p>
                <p><strong>Amount Requested:</strong> ${payoutData.amount} AED</p>
                <p><strong>Request Date:</strong> ${new Date(payoutData.request_date).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</p>
            </div>

            <div class="details">
                <h3>👤 User Details</h3>
                <p><strong>Name:</strong> ${payoutData.user_name}</p>
                <p><strong>Email:</strong> ${payoutData.user_email}</p>
                <p><strong>Role:</strong> ${payoutData.user_role}</p>
                <p><strong>User ID:</strong> ${payoutData.user_id}</p>
            </div>

            ${payoutData.auction_ids && payoutData.auction_ids.length > 0 ? `
                <div class="details">
                    <h3>🎯 Auction Details</h3>
                    <p><strong>Number of Auctions:</strong> ${payoutData.auction_ids.length}</p>
                    ${payoutData.auction_ids.map((id, index) => `
                        <div style="margin: 10px 0; padding: 10px; background: #fff; border-left: 3px solid #6366f1;">
                            <p style="margin: 5px 0;"><strong>Auction ${index + 1}:</strong></p>
                            <p style="margin: 5px 0;"><strong>ID:</strong> ${id}</p>
                            ${payoutData.auction_titles && payoutData.auction_titles[index] ? `<p style="margin: 5px 0;"><strong>Title:</strong> ${payoutData.auction_titles[index]}</p>` : ''}
                            ${payoutData.auction_amounts && payoutData.auction_amounts[index] ? `<p style="margin: 5px 0;"><strong>Payout Amount:</strong> ${payoutData.auction_amounts[index]} AED</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="details">
                <h3>🏢 Company Details</h3>
                <p><strong>Company:</strong> ${payoutData.company_name}</p>
                <p><strong>Branch:</strong> ${payoutData.branch_name || 'Not specified'}</p>
                <p><strong>Total Earnings:</strong> ${payoutData.total_earnings || 'Unknown'} AED</p>
                <p><strong>Available Balance:</strong> ${payoutData.available_balance || 'Unknown'} AED</p>
                <p><strong>Previous Payouts:</strong> ${payoutData.previous_payouts_count || 0}</p>
            </div>

            ${payoutData.preferred_payout_method || payoutData.beneficiary_name || payoutData.paypal_email ? `
                <div class="details">
                    <h3>💳 Preferred Payment Method</h3>
                    <p><strong>Method:</strong> ${payoutData.preferred_payout_method ?
                        payoutData.preferred_payout_method === 'bank_account' ? 'Bank Account' :
                        payoutData.preferred_payout_method === 'paypal' ? 'PayPal' :
                        payoutData.preferred_payout_method === 'stripe_connect' ? 'Stripe Connect' :
                        payoutData.preferred_payout_method : 'Not specified'}</p>
                    ${payoutData.preferred_payout_method === 'bank_account' && payoutData.beneficiary_name ? `
                        <p><strong>Beneficiary Name:</strong> ${payoutData.beneficiary_name}</p>
                        <p><strong>Bank:</strong> ${payoutData.bank_name || 'Not specified'}</p>
                        <p><strong>IBAN:</strong> ${payoutData.iban_number || 'Not specified'}</p>
                        ${payoutData.account_type ? `<p><strong>Account Type:</strong> ${payoutData.account_type}</p>` : ''}
                    ` : ''}
                    ${payoutData.preferred_payout_method === 'paypal' && payoutData.paypal_email ? `
                        <p><strong>PayPal Email:</strong> ${payoutData.paypal_email}</p>
                        <p><strong>PayPal Account Type:</strong> ${payoutData.paypal_account_type || 'Personal'}</p>
                    ` : ''}
                    ${payoutData.preferred_payout_method === 'stripe_connect' ? `
                        <p><strong>Stripe Connect ID:</strong> ${payoutData.stripe_connect_account_id || 'Not connected'}</p>
                    ` : ''}
                    ${payoutData.beneficiary_name && payoutData.preferred_payout_method !== 'bank_account' ? `
                        <h4>🏦 Bank Account Details</h4>
                        <p><strong>Beneficiary Name:</strong> ${payoutData.beneficiary_name}</p>
                        <p><strong>Bank Name:</strong> ${payoutData.bank_name || 'Not specified'}</p>
                        <p><strong>Account Type:</strong> ${payoutData.account_type || 'Not specified'}</p>
                        <p><strong>IBAN:</strong> ${payoutData.iban_number || 'N/A'}</p>
                    ` : ''}
                    ${payoutData.paypal_email && payoutData.preferred_payout_method !== 'paypal' ? `
                        <h4>💙 PayPal Account Details</h4>
                        <p><strong>PayPal Email:</strong> ${payoutData.paypal_email}</p>
                        <p><strong>Account Type:</strong> ${payoutData.paypal_account_type || 'Personal'}</p>
                    ` : ''}
                </div>
            ` : ''}

            ${payoutData.last_payout_date ? `
                <div class="details">
                    <h3>📊 Payout History</h3>
                    <p><strong>Last Payout Date:</strong> ${new Date(payoutData.last_payout_date).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</p>
                    <p><strong>Last Payout Amount:</strong> ${payoutData.last_payout_amount || 0} AED</p>
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Payout Request

REQUEST DETAILS
Request ID: ${payoutData.payout_request_id || 'Pending'}
Amount Requested: ${payoutData.amount} AED
Request Date: ${new Date(payoutData.request_date).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}

USER DETAILS
Name: ${payoutData.user_name}
Email: ${payoutData.user_email}
Role: ${payoutData.user_role}
User ID: ${payoutData.user_id}

${payoutData.auction_ids && payoutData.auction_ids.length > 0 ? `
AUCTION DETAILS
Number of Auctions: ${payoutData.auction_ids.length}
${payoutData.auction_ids.map((id, index) => `
Auction ${index + 1}:
  ID: ${id}${payoutData.auction_titles && payoutData.auction_titles[index] ? `
  Title: ${payoutData.auction_titles[index]}` : ''}${payoutData.auction_amounts && payoutData.auction_amounts[index] ? `
  Payout Amount: ${payoutData.auction_amounts[index]} AED` : ''}
`).join('')}
` : ''}
COMPANY DETAILS
Company: ${payoutData.company_name}
Branch: ${payoutData.branch_name || 'Not specified'}
Total Earnings: ${payoutData.total_earnings || 'Unknown'} AED
Available Balance: ${payoutData.available_balance || 'Unknown'} AED
Previous Payouts: ${payoutData.previous_payouts_count || 0}

${payoutData.preferred_payout_method || payoutData.beneficiary_name || payoutData.paypal_email ? `
PREFERRED PAYMENT METHOD
Method: ${payoutData.preferred_payout_method ?
    payoutData.preferred_payout_method === 'bank_account' ? 'Bank Account' :
    payoutData.preferred_payout_method === 'paypal' ? 'PayPal' :
    payoutData.preferred_payout_method === 'stripe_connect' ? 'Stripe Connect' :
    payoutData.preferred_payout_method : 'Not specified'}
${payoutData.preferred_payout_method === 'bank_account' && payoutData.beneficiary_name ? `Beneficiary Name: ${payoutData.beneficiary_name}
Bank: ${payoutData.bank_name || 'Not specified'}
IBAN: ${payoutData.iban_number || 'Not specified'}${payoutData.account_type ? `
Account Type: ${payoutData.account_type}` : ''}` : ''}
${payoutData.preferred_payout_method === 'paypal' && payoutData.paypal_email ? `PayPal Email: ${payoutData.paypal_email}
PayPal Account Type: ${payoutData.paypal_account_type || 'Personal'}` : ''}
${payoutData.preferred_payout_method === 'stripe_connect' ? `Stripe Connect ID: ${payoutData.stripe_connect_account_id || 'Not connected'}` : ''}
${payoutData.beneficiary_name && payoutData.preferred_payout_method !== 'bank_account' ? `
BANK ACCOUNT DETAILS
Beneficiary Name: ${payoutData.beneficiary_name}
Bank Name: ${payoutData.bank_name || 'Not specified'}
Account Type: ${payoutData.account_type || 'Not specified'}
IBAN: ${payoutData.iban_number || 'N/A'}
` : ''}${payoutData.paypal_email && payoutData.preferred_payout_method !== 'paypal' ? `
PAYPAL ACCOUNT DETAILS
PayPal Email: ${payoutData.paypal_email}
Account Type: ${payoutData.paypal_account_type || 'Personal'}
` : ''}` : ''}

${payoutData.last_payout_date ? `
PAYOUT HISTORY
Last Payout Date: ${new Date(payoutData.last_payout_date).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}
Last Payout Amount: ${payoutData.last_payout_amount || 0} AED
` : ''}
`

    return { html, text }
  }

  /**
   * Render model auction completed email
   */
  private async renderModelAuctionCompletedEmail(data: {
    model_email: string
    model_name: string
    auction_id: string
    auction_title: string
    winning_bid_amount: number
    winner_name: string
    auction_start_price: number
    platform_fee: number
    model_payout: number
    dashboard_url: string
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
    <title>Auction Completed Successfully</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: left; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-icon { font-size: 48px; color: #4CAF50; margin-bottom: 20px; text-align: left; }
        .amount { font-size: 32px; font-weight: bold; color: #4CAF50; margin: 20px 0; text-align: left; }
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
            <h2>🎉 Auction Completed Successfully!</h2>
        </div>
        <div class="content">
            <h3 style="text-align: left;">Congrats, ${data.model_name}!</h3>
            <p style="text-align: left;">Your beauty auction "${data.auction_title}" has ended with a winning bid.</p>

            <div class="details">
                <h4>Winning Bid</h4>
                <div class="amount">AED ${data.winning_bid_amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                <p style="text-align: left;">${data.winner_name}</p>
            </div>

            <div class="details">
                <h4>Auction Breakdown</h4>
                <div class="detail-row">
                    <span>Winning Bid:</span>
                    <span>AED ${data.winning_bid_amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="detail-row">
                    <span>Beauty Service Price:</span>
                    <span>- AED ${data.auction_start_price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="detail-row" style="font-weight: bold; font-size: 18px;">
                    <span>Your Payout:</span>
                    <span style="color: #4CAF50;">AED ${data.model_payout.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            </div>

            <div class="details">
                <h4>Next Step</h4>
                <p>The winner has <strong>24 hours</strong> to upload their video message.</p>
                <p>You'll be notified once it's uploaded—watch it to unlock your payout.</p>
            </div>

            <div style="text-align: center;">
                <a href="${data.dashboard_url}" class="button">View Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>If you have any questions, please contact DECODE support.</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Auction Completed Successfully!

Congrats, ${data.model_name}!

Your beauty auction "${data.auction_title}" has ended with a winning bid.

Winning Bid
AED ${data.winning_bid_amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
${data.winner_name}

Auction Breakdown
Winning Bid: AED ${data.winning_bid_amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Beauty Service Price: - AED ${data.auction_start_price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Your Payout: AED ${data.model_payout.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

Next Step
The winner has 24 hours to upload their video message.
You'll be notified once it's uploaded—watch it to unlock your payout.

View Dashboard: ${data.dashboard_url}

If you have any questions, please contact DECODE support.
`

    return { html, text }
  }

  /**
   * Render model video uploaded email
   */
  private async renderModelVideoUploadedEmail(data: {
    model_email: string
    model_name: string
    auction_id: string
    auction_title: string
    winner_name: string
    video_uploaded_at: string
    dashboard_url: string
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
    <title>Winner Has Uploaded Video</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-icon { font-size: 48px; color: #2196F3; margin-bottom: 20px; text-align: center; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .important-note { background: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>DECODE</h1>
            <h2>Winner Video</h2>
        </div>
        <div class="content">
            <div class="info-icon">🎬</div>
            <h3 style="text-align: center;">Great news, ${data.model_name}!</h3>
            <p style="text-align: center;">The winner of beauty auction "${data.auction_title}" has uploaded the video message.</p>

            <div class="details">
                <h4>Beauty Auction</h4>
                <p><strong>Auction:</strong> ${data.auction_title}</p>
                <p><strong>Winner:</strong> ${data.winner_name}</p>
                <p><strong>Video Uploaded:</strong> ${new Date(data.video_uploaded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })}</p>
            </div>

            <div class="important-note">
                <h4 style="margin-top: 0;">Action Required</h4>
                <p style="margin-bottom: 0;">Watch the full video to unlock your payout.</p>
            </div>

            <div style="text-align: center;">
                <a href="${data.dashboard_url}" class="button">Watch Video & Unlock Payout</a>
            </div>
        </div>
        <div class="footer">
            <p>If you have any questions, please contact DECODE support.</p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Winner Video

Great news, ${data.model_name}!

The winner of beauty auction "${data.auction_title}" has uploaded the video message.

BEAUTY AUCTION
Auction: ${data.auction_title}
Winner: ${data.winner_name}
Video Uploaded: ${new Date(data.video_uploaded_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })}

ACTION REQUIRED
Watch the full video to unlock your payout.

Watch Video & Unlock Payout: ${data.dashboard_url}

---
If you have any questions, please contact DECODE support.
`

    return { html, text }
  }

  /**
   * Render model payout request confirmed email
   */
  private async renderModelPayoutRequestConfirmedEmail(data: {
    model_email: string
    model_name: string
    payout_request_id: string
    payout_amount: number
    payout_method: string
    request_date: string
    dashboard_url: string
    support_email: string
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
    <title>Payout Request Confirmed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-icon { font-size: 48px; color: #4CAF50; margin-bottom: 20px; text-align: center; }
        .request-id { background: #E8F5E9; border: 2px solid #4CAF50; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .request-id-value { font-size: 24px; font-weight: bold; color: #4CAF50; font-family: monospace; }
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
            <h2>Payout Request Processing</h2>
        </div>
        <div class="content">
            <h3 style="text-align: center;">Thank you, ${data.model_name}!</h3>
            <p style="text-align: center;">We've received your payout request and it's being processed.</p>

            <div class="request-id">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Payout Request ID</p>
                <div class="request-id-value">${data.payout_request_id}</div>
            </div>

            <div class="details">
                <h4>Payout Details</h4>
                <div class="detail-row">
                    <span>Amount:</span>
                    <span><strong>AED ${data.payout_amount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
                <div class="detail-row">
                    <span>Payment Method:</span>
                    <span>${data.payout_method}</span>
                </div>
                <div class="detail-row">
                    <span>Request Date:</span>
                    <span>${new Date(data.request_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: 'Asia/Dubai' })}</span>
                </div>
            </div>

            <div class="details">
                <h4>Next Step</h4>
                <p>Your payout will be processed within <strong>2-3 business days</strong>.</p>
            </div>

            <div style="text-align: center;">
                <a href="${data.dashboard_url}" class="button">Track Status in Dashboard</a>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;">
                If you have any questions, please contact DECODE support.
            </p>
        </div>
    </div>
</body>
</html>`

    const text = `
DECODE - Payout Request Processing

Thank you, ${data.model_name}!

We've received your payout request and it's being processed.

PAYOUT REQUEST ID
${data.payout_request_id}

PAYOUT DETAILS
Amount: AED ${data.payout_amount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Payment Method: ${data.payout_method}
Request Date: ${new Date(data.request_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: 'Asia/Dubai' })}

NEXT STEP
Your payout will be processed within 2-3 business days.

Track Status: ${data.dashboard_url}

If you have any questions, please contact DECODE support.
`

    return { html, text }
  }
}

// Export singleton instance
export const emailService = new EmailService()

// Export types and interfaces
export type { EmailConfig }