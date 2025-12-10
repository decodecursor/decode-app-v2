import { NextResponse } from 'next/server'

export async function GET() {
  // Check email configuration
  const config = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY_EXISTS: !!process.env.RESEND_API_KEY,
    RESEND_API_KEY_LENGTH: process.env.RESEND_API_KEY?.length || 0,
    RESEND_API_KEY_PREFIX: process.env.RESEND_API_KEY?.substring(0, 10) || 'NOT_SET',
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    timestamp: new Date().toISOString()
  }

  // Test sending an actual email
  let emailTestResult = null
  try {
    const { emailService } = await import('@/lib/email-service')

    const result = await emailService.sendAdminUserRegistrationNotification({
      id: 'test-config-' + Date.now(),
      email: 'test@example.com',
      user_name: 'Test Config User',
      role: 'Staff',
      company_name: 'Config Test Company',
      branch_name: 'Main Branch',
      approval_status: 'pending',
      created_at: new Date().toISOString()
    })

    emailTestResult = {
      success: result.success,
      error: result.error,
      provider: result.provider,
      messageId: result.messageId
    }
  } catch (error: any) {
    emailTestResult = {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }

  return NextResponse.json({
    config,
    emailTestResult
  })
}