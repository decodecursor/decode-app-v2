/**
 * POST /api/auctions/create
 * Create a new auction (MODEL users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionService } from '@/lib/services/AuctionService';
import type { CreateAuctionDto } from '@/lib/models/Auction.model';
import { USER_ROLES, normalizeRole } from '@/types/user';
import { getEventBridgeScheduler } from '@/lib/services/EventBridgeScheduler';

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 [API /auctions/create] Request received');
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('🔐 [API /auctions/create] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!authError,
      error: authError?.message
    });

    if (authError || !user) {
      console.error('❌ [API /auctions/create] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a MODEL
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('👤 [API /auctions/create] User role fetch:', {
      hasData: !!userData,
      role: userData?.role,
      hasError: !!userError,
      error: userError?.message
    });

    if (userError || !userData) {
      console.error('❌ [API /auctions/create] User not found in database');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Normalize role and check if MODEL
    const normalizedRole = normalizeRole(userData.role);
    console.log('🔍 [API /auctions/create] Role check:', {
      rawRole: userData.role,
      normalizedRole: normalizedRole,
      expectedRole: USER_ROLES.MODEL,
      matches: normalizedRole === USER_ROLES.MODEL
    });

    if (normalizedRole !== USER_ROLES.MODEL) {
      console.error('❌ [API /auctions/create] Access denied - user is not MODEL');
      return NextResponse.json(
        { error: 'Only MODEL users can create auctions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log('📦 [API /auctions/create] Request body:', body);

    // Validate required fields
    if (!body.title || !body.start_price || !body.duration) {
      console.error('❌ [API /auctions/create] Validation failed - missing fields');
      return NextResponse.json(
        { error: 'Missing required fields: title, start_price, duration' },
        { status: 400 }
      );
    }

    // Validate duration
    const validDurations = [5, 30, 60, 180, 1440];
    if (!validDurations.includes(body.duration)) {
      console.error('❌ [API /auctions/create] Validation failed - invalid duration:', body.duration);
      return NextResponse.json(
        { error: 'Invalid duration. Must be 5, 30, 60, 180, or 1440 minutes' },
        { status: 400 }
      );
    }

    // Create auction
    const auctionService = new AuctionService();
    const dto: CreateAuctionDto = {
      creator_id: user.id,
      title: body.title,
      description: body.description,
      start_price: parseFloat(body.start_price),
      buy_now_price: body.buy_now_price ? parseFloat(body.buy_now_price) : undefined,
      duration: body.duration,
      start_time: body.start_time,
    };

    console.log('🎯 [API /auctions/create] Calling AuctionService with DTO:', dto);

    const result = await auctionService.createAuction(dto);

    console.log('📊 [API /auctions/create] Service result:', {
      success: result.success,
      auctionId: result.auction_id,
      error: result.error
    });

    if (!result.success) {
      console.error('❌ [API /auctions/create] Service returned error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Start auction immediately if start_time is now or in the past
    const startTime = body.start_time ? new Date(body.start_time) : new Date();
    if (startTime <= new Date()) {
      console.log('▶️ [API /auctions/create] Starting auction immediately');
      await auctionService.startAuction(result.auction_id!);
    }

    // Schedule auction close with EventBridge
    try {
      console.log('📅 [API /auctions/create] Scheduling EventBridge close event');

      // Get the auction to retrieve end_time
      const auction = await auctionService.getAuctionById(result.auction_id!);

      if (auction && auction.end_time) {
        const scheduler = getEventBridgeScheduler();
        const scheduleResult = await scheduler.scheduleAuctionClose({
          auctionId: auction.id,
          endTime: new Date(auction.end_time),
        });

        if (scheduleResult.success && scheduleResult.schedulerEventId) {
          console.log('✅ [API /auctions/create] EventBridge schedule created:', scheduleResult.schedulerEventId);

          // Store scheduler_event_id in database
          await auctionService.updateAuction(auction.id, {
            scheduler_event_id: scheduleResult.schedulerEventId,
          });
        } else {
          console.error('❌ [API /auctions/create] Failed to create EventBridge schedule:', scheduleResult.error);
          // Don't fail the entire request - auction is still created
          // Fallback cron will handle it if EventBridge fails
        }
      }
    } catch (scheduleError) {
      console.error('❌ [API /auctions/create] Error scheduling EventBridge:', scheduleError);
      // Don't fail the entire request
    }

    console.log('✅ [API /auctions/create] Auction created successfully:', result.auction_id);
    return NextResponse.json(
      {
        success: true,
        auction_id: result.auction_id,
        message: 'Auction created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('💥 [API /auctions/create] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
