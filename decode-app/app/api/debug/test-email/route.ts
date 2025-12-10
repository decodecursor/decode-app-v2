/**
 * POST /api/debug/test-email
 * Test email service configuration by sending a test email
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const { to, testType } = await request.json();

    if (!to) {
      return NextResponse.json(
        { error: 'Missing "to" email address' },
        { status: 400 }
      );
    }

    console.log(`🧪 [Email Test] Sending ${testType || 'basic'} test email to ${to}`);

    let subject: string;
    let html: string;

    if (testType === 'winner') {
      // Test winner notification email
      subject = 'Test: Congratulations! You won "Test Auction"';
      html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">🧪 TEST EMAIL - Congratulations!</h1>

            <p>This is a test email to verify the email service is working correctly.</p>

            <p>You won the auction for <strong>"Test Auction Item"</strong> with a winning bid of <strong>$100.00</strong>.</p>

            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">🎥 Record Your Video Message</h2>
              <p>As the winner, you can now record a 10-second video message for the auction creator!</p>
              <p><a href="#" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Record Video Now (Test Link)</a></p>
              <p style="font-size: 14px; color: #6B7280;">This link expires in 24 hours. You can retake once if needed.</p>
            </div>

            <p style="font-size: 14px; color: #6B7280;">If you received this email, the email service is configured correctly!</p>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
            <p style="font-size: 12px; color: #6B7280;">This is a TEST message from DECODE Beauty Platform.</p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Basic test email
      subject = 'Test Email from DECODE Platform';
      html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">🧪 Test Email</h1>
            <p>This is a test email to verify the email service is configured correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Email Provider:</strong> ${process.env.EMAIL_PROVIDER || 'Not configured'}</p>
            <p><strong>From:</strong> ${process.env.EMAIL_FROM || 'Not configured'}</p>
            <p>If you received this email, the email service is working! ✅</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
            <p style="font-size: 12px; color: #6B7280;">This is a TEST message from DECODE Beauty Platform.</p>
          </div>
        </body>
        </html>
      `;
    }

    // Send test email
    const result = await emailService.send({
      to,
      subject,
      html,
    });

    if (result.success) {
      console.log(`✅ [Email Test] Test email sent successfully`);
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Provider: ${result.provider}`);

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        to,
        subject,
        messageId: result.messageId,
        provider: result.provider,
      });
    } else {
      console.error(`❌ [Email Test] Failed to send test email:`, result.error);

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          to,
          subject,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Email Test] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
