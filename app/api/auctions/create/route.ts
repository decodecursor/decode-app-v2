/**
 * POST /api/auctions/create
 * Create a new auction (MODEL users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionService } from '@/lib/services/AuctionService';
import type { CreateAuctionDto } from '@/lib/models/Auction.model';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a MODEL (Beauty Model role)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'Beauty Model') {
      return NextResponse.json(
        { error: 'Only MODEL users can create auctions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.start_price || !body.duration) {
      return NextResponse.json(
        { error: 'Missing required fields: title, start_price, duration' },
        { status: 400 }
      );
    }

    // Validate duration
    const validDurations = [30, 60, 180, 1440];
    if (!validDurations.includes(body.duration)) {
      return NextResponse.json(
        { error: 'Invalid duration. Must be 30, 60, 180, or 1440 minutes' },
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

    const result = await auctionService.createAuction(dto);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Start auction immediately if start_time is now or in the past
    const startTime = body.start_time ? new Date(body.start_time) : new Date();
    if (startTime <= new Date()) {
      await auctionService.startAuction(result.auction_id!);
    }

    return NextResponse.json(
      {
        success: true,
        auction_id: result.auction_id,
        message: 'Auction created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/auctions/create:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
