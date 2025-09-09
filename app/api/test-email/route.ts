import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('🧪 [TEST EMAIL] Starting test email endpoint...')
    
    const body = await request.json()
    const { email } = body
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    console.log(`🧪 [TEST EMAIL] Testing email delivery to: ${email}`)
    
    // Direct Resend API test
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM || 'DECODE Beauty <noreply@welovedecode.com>'
    
    console.log(`🧪 [TEST EMAIL] API key present: ${apiKey ? 'YES' : 'NO'}`)
    console.log(`🧪 [TEST EMAIL] From email: ${fromEmail}`)
    
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }
    
    const emailPayload = {
      from: fromEmail,
      to: [email],
      subject: 'Test Email from DECODE',
      html: '<h1>Test Email</h1><p>This is a test email from DECODE to verify Resend integration is working.</p>',
      text: 'Test Email - This is a test email from DECODE to verify Resend integration is working.'
    }
    
    console.log(`🧪 [TEST EMAIL] Sending payload:`, emailPayload)
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    })
    
    console.log(`🧪 [TEST EMAIL] Resend response status: ${response.status}`)
    
    const result = await response.json()
    console.log(`🧪 [TEST EMAIL] Resend response:`, result)
    
    if (!response.ok) {
      console.error(`🧪 [TEST EMAIL] Resend API error:`, result)
      return NextResponse.json({ 
        error: 'Failed to send test email', 
        details: result 
      }, { status: 500 })
    }
    
    console.log(`🧪 [TEST EMAIL] SUCCESS: Test email sent with ID ${result.id}`)
    
    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      messageId: result.id,
      resendResponse: result
    })
    
  } catch (error) {
    console.error('🧪 [TEST EMAIL] Exception:', error)
    return NextResponse.json({ 
      error: 'Test email failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}