/**
 * Auction Notification Service
 * Handles email notifications and in-page notifications for auction events
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email-service';

export class AuctionNotificationService {
  /**
   * Send winner notification (email + in-page prompt)
   */
  async notifyWinner(params: {
    auction_id: string;
    bid_id: string;
    winner_email: string;
    winner_name: string;
    auction_title: string;
    winning_amount: number;
    recording_token: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const recordingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auctions/video/${params.recording_token}`;

      // Send email notification
      await sendEmail({
        to: params.winner_email,
        subject: `Congratulations! You won "${params.auction_title}"`,
        html: this.getWinnerEmailTemplate({
          winner_name: params.winner_name,
          auction_title: params.auction_title,
          winning_amount: params.winning_amount,
          recording_url: recordingUrl,
        }),
      });

      console.log(`Winner notification sent to ${params.winner_email}`);
      return { success: true };
    } catch (error) {
      console.error('Error sending winner notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification',
      };
    }
  }

  /**
   * Send outbid notification
   */
  async notifyOutbid(params: {
    auction_id: string;
    auction_title: string;
    bidder_email: string;
    bidder_name: string;
    old_bid_amount: number;
    new_highest_bid: number;
  }): Promise<void> {
    try {
      const auctionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auctions/${params.auction_id}`;

      await sendEmail({
        to: params.bidder_email,
        subject: `You've been outbid on "${params.auction_title}"`,
        html: this.getOutbidEmailTemplate({
          bidder_name: params.bidder_name,
          auction_title: params.auction_title,
          old_bid_amount: params.old_bid_amount,
          new_highest_bid: params.new_highest_bid,
          auction_url: auctionUrl,
        }),
      });

      console.log(`Outbid notification sent to ${params.bidder_email}`);
    } catch (error) {
      console.error('Error sending outbid notification:', error);
    }
  }

  /**
   * Send auction ending soon notification
   */
  async notifyAuctionEndingSoon(params: {
    auction_id: string;
    auction_title: string;
    bidder_emails: string[];
    minutes_remaining: number;
  }): Promise<void> {
    try {
      const auctionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auctions/${params.auction_id}`;

      for (const email of params.bidder_emails) {
        await sendEmail({
          to: email,
          subject: `"${params.auction_title}" ending in ${params.minutes_remaining} minutes!`,
          html: this.getEndingSoonEmailTemplate({
            auction_title: params.auction_title,
            minutes_remaining: params.minutes_remaining,
            auction_url: auctionUrl,
          }),
        });
      }

      console.log(`Ending soon notifications sent for auction ${params.auction_id}`);
    } catch (error) {
      console.error('Error sending ending soon notifications:', error);
    }
  }

  /**
   * Send auction ended notification
   */
  async notifyAuctionEnded(params: {
    auction_id: string;
    auction_title: string;
    creator_email: string;
    creator_name: string;
    winner_name?: string;
    winning_amount?: number;
  }): Promise<void> {
    try {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/auctions`;

      await sendEmail({
        to: params.creator_email,
        subject: `Your auction "${params.auction_title}" has ended`,
        html: this.getAuctionEndedEmailTemplate({
          creator_name: params.creator_name,
          auction_title: params.auction_title,
          winner_name: params.winner_name,
          winning_amount: params.winning_amount,
          dashboard_url: dashboardUrl,
        }),
      });

      console.log(`Auction ended notification sent to creator ${params.creator_email}`);
    } catch (error) {
      console.error('Error sending auction ended notification:', error);
    }
  }

  /**
   * Email Templates
   */
  private getWinnerEmailTemplate(params: {
    winner_name: string;
    auction_title: string;
    winning_amount: number;
    recording_url: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5;">Congratulations ${params.winner_name}!</h1>

          <p>You won the auction for <strong>"${params.auction_title}"</strong> with a winning bid of <strong>$${params.winning_amount.toFixed(2)}</strong>.</p>

          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">🎥 Record Your Video Message</h2>
            <p>As the winner, you can now record a 10-second video message for the auction creator!</p>
            <p><a href="${params.recording_url}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Record Video Now</a></p>
            <p style="font-size: 14px; color: #6B7280;">This link expires in 24 hours. You can retake once if needed.</p>
          </div>

          <p>Thank you for participating!</p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          <p style="font-size: 12px; color: #6B7280;">This is an automated message from DECODE Beauty Platform.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getOutbidEmailTemplate(params: {
    bidder_name: string;
    auction_title: string;
    old_bid_amount: number;
    new_highest_bid: number;
    auction_url: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #EF4444;">You've Been Outbid!</h1>

          <p>Hi ${params.bidder_name},</p>

          <p>Someone just placed a higher bid on <strong>"${params.auction_title}"</strong>.</p>

          <ul>
            <li>Your bid: <strong>$${params.old_bid_amount.toFixed(2)}</strong></li>
            <li>Current highest bid: <strong>$${params.new_highest_bid.toFixed(2)}</strong></li>
          </ul>

          <p><a href="${params.auction_url}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Place a Higher Bid</a></p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          <p style="font-size: 12px; color: #6B7280;">This is an automated message from DECODE Beauty Platform.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getEndingSoonEmailTemplate(params: {
    auction_title: string;
    minutes_remaining: number;
    auction_url: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #F59E0B;">⏰ Auction Ending Soon!</h1>

          <p>The auction for <strong>"${params.auction_title}"</strong> is ending in <strong>${params.minutes_remaining} minutes</strong>!</p>

          <p><a href="${params.auction_url}" style="display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Auction</a></p>

          <p>Don't miss your chance to place a final bid!</p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          <p style="font-size: 12px; color: #6B7280;">This is an automated message from DECODE Beauty Platform.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getAuctionEndedEmailTemplate(params: {
    creator_name: string;
    auction_title: string;
    winner_name?: string;
    winning_amount?: number;
    dashboard_url: string;
  }): string {
    const winnerInfo = params.winner_name
      ? `
        <p><strong>Winner:</strong> ${params.winner_name}</p>
        <p><strong>Winning Bid:</strong> $${params.winning_amount?.toFixed(2)}</p>
      `
      : `<p>No bids were placed on this auction.</p>`;

    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5;">Auction Ended</h1>

          <p>Hi ${params.creator_name},</p>

          <p>Your auction for <strong>"${params.auction_title}"</strong> has ended.</p>

          ${winnerInfo}

          <p><a href="${params.dashboard_url}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Dashboard</a></p>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          <p style="font-size: 12px; color: #6B7280;">This is an automated message from DECODE Beauty Platform.</p>
        </div>
      </body>
      </html>
    `;
  }
}
