/**
 * POST /api/auctions/test/create-short
 * Test endpoint to create a 1-minute auction for testing EventBridge scheduling
 *
 * ONLY WORKS IN DEVELOPMENT MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionService } from '@/lib/services/AuctionService';
import type { CreateAuctionDto } from '@/lib/models/Auction.model';
import { USER_ROLES, normalizeRole } from '@/types/user';
import { getEventBridgeScheduler } from '@/lib/services/EventBridgeScheduler';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Test endpoint not available in production' },
        { status: 403 }
      );
    }

    console.log('🧪 [Test] Creating 1-minute test auction');
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [Test] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a MODEL
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('❌ [Test] User not found in database');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const normalizedRole = normalizeRole(userData.role);
    if (normalizedRole !== USER_ROLES.MODEL) {
      console.error('❌ [Test] Access denied - user is not MODEL');
      return NextResponse.json(
        { error: 'Only MODEL users can create auctions' },
        { status: 403 }
      );
    }

    // Create 1-minute test auction
    const auctionService = new AuctionService();
    const dto: CreateAuctionDto = {
      creator_id: user.id,
      title: `[TEST] 1-Minute Auction ${new Date().toISOString()}`,
      description: 'Test auction for EventBridge scheduler validation',
      start_price: 5.0,
      duration: 5, // 5 minutes (minimum allowed duration)
      start_time: new Date().toISOString(), // Start immediately
    };

    console.log('🎯 [Test] Creating auction with DTO:', dto);

    const result = await auctionService.createAuction(dto);

    if (!result.success) {
      console.error('❌ [Test] Service returned error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Start auction immediately
    console.log('▶️ [Test] Starting auction immediately');
    await auctionService.startAuction(result.auction_id!);

    // Schedule EventBridge close
    console.log('📅 [Test] Scheduling EventBridge close event');
    const auction = await auctionService.getAuctionById(result.auction_id!);

    if (auction && auction.end_time) {
      const scheduler = getEventBridgeScheduler();
      const scheduleResult = await scheduler.scheduleAuctionClose({
        auctionId: auction.id,
        endTime: new Date(auction.end_time),
      });

      if (scheduleResult.success && scheduleResult.schedulerEventId) {
        console.log('✅ [Test] EventBridge schedule created:', scheduleResult.schedulerEventId);

        await auctionService.updateAuction(auction.id, {
          scheduler_event_id: scheduleResult.schedulerEventId,
        });

        return NextResponse.json(
          {
            success: true,
            auction_id: result.auction_id,
            scheduler_event_id: scheduleResult.schedulerEventId,
            end_time: auction.end_time,
            message: '1-minute test auction created successfully',
            test_info: {
              duration_minutes: 5,
              ends_at: auction.end_time,
              view_url: `/auctions/${result.auction_id}`,
            },
          },
          { status: 201 }
        );
      } else {
        console.error('❌ [Test] Failed to create EventBridge schedule:', scheduleResult.error);
        return NextResponse.json(
          {
            error: 'Failed to schedule EventBridge event',
            details: scheduleResult.error,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to retrieve auction after creation' },
      { status: 500 }
    );
  } catch (error) {
    console.error('💥 [Test] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
