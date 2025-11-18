/**
 * POST /api/auctions/[id]/cancel
 * Cancel an auction and release all payment authorizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionService } from '@/lib/services/AuctionService';
import { AuctionPaymentProcessor } from '@/lib/payments/processors/AuctionPaymentProcessor';
import { getEventBridgeScheduler } from '@/lib/services/EventBridgeScheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const auctionService = new AuctionService();
    const paymentProcessor = new AuctionPaymentProcessor();

    // Get auction to verify ownership
    const auction = await auctionService.getAuction(params.id);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Verify user is the creator
    if (auction.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the auction creator can cancel this auction' },
        { status: 403 }
      );
    }

    // Check auction can be cancelled
    if (auction.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Auction is already cancelled' },
        { status: 400 }
      );
    }

    if (auction.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed auction' },
        { status: 400 }
      );
    }

    // Delete EventBridge schedule if it exists
    if (auction.scheduler_event_id) {
      try {
        console.log(`[Auction Cancel] Deleting EventBridge schedule: ${auction.scheduler_event_id}`);
        const scheduler = getEventBridgeScheduler();
        await scheduler.cancelSchedule(auction.scheduler_event_id);
        console.log(`[Auction Cancel] EventBridge schedule deleted successfully`);
      } catch (scheduleError) {
        console.error('[Auction Cancel] Error deleting EventBridge schedule:', scheduleError);
        // Don't fail the cancellation if EventBridge deletion fails
      }
    }

    // Cancel all payment authorizations
    await paymentProcessor.cancelAllPreAuths(params.id);

    // Set auction status to cancelled
    await auctionService.cancelAuction(params.id);

    return NextResponse.json({
      success: true,
      message: 'Auction cancelled successfully. All payment authorizations have been released.',
    });
  } catch (error) {
    console.error('Error in POST /api/auctions/[id]/cancel:', error);
    return NextResponse.json(
      { error: 'Failed to cancel auction' },
      { status: 500 }
    );
  }
}
