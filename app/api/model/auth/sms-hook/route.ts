import { NextRequest, NextResponse } from 'next/server'
import { Webhook, WebhookVerificationError } from 'standardwebhooks'
import { authkeyWhatsAppService } from '@/lib/services/AuthkeyWhatsAppService'

// Supabase Send SMS Hook → AUTHKey WhatsApp delivery.
// Supabase generates the OTP and POSTs here so we can route delivery through
// AUTHKey instead of Supabase's built-in Twilio. Configured in Supabase
// dashboard at Auth → SMS Settings → Send SMS Hook URL.

interface SupabaseSendSmsPayload {
  user: { id: string; phone?: string }
  sms: { otp: string; sms_type?: string }
}

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_SEND_SMS_HOOK_SECRET
  if (!secret) {
    console.error('[sms-hook] SUPABASE_SEND_SMS_HOOK_SECRET not set')
    return NextResponse.json({ error: 'Hook not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const headers: Record<string, string> = {
    'webhook-id': request.headers.get('webhook-id') ?? '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
    'webhook-signature': request.headers.get('webhook-signature') ?? '',
  }

  let payload: SupabaseSendSmsPayload
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(rawBody, headers) as SupabaseSendSmsPayload
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.warn('[sms-hook] signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    console.error('[sms-hook] verify threw unexpected error:', err)
    return NextResponse.json({ error: 'Verification error' }, { status: 500 })
  }

  const phone = payload.user?.phone
  const otp = payload.sms?.otp
  if (!phone || !otp) {
    console.error('[sms-hook] payload missing phone or otp')
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
  }

  const e164 = phone.startsWith('+') ? phone : `+${phone}`

  if (!authkeyWhatsAppService.isConfigured()) {
    console.error('[sms-hook] AUTHKey not configured')
    return NextResponse.json({ error: 'WhatsApp service unavailable' }, { status: 503 })
  }

  const result = await authkeyWhatsAppService.sendOTP(e164, otp)
  if (!result.success) {
    console.error('[sms-hook] AUTHKey send failed:', result.error)
    return NextResponse.json({ error: result.error || 'Send failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
