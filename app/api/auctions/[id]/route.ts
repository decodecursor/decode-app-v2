/**
 * GET/PATCH/DELETE /api/auctions/[id]
 * Manage individual auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuctionService } from '@/lib/services/AuctionService';
import type { UpdateAuctionDto } from '@/lib/models/Auction.model';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auctionService = new AuctionService();
    const auction = await auctionService.getAuction(params.id);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      auction,
    });
  } catch (error) {
    console.error('Error in GET /api/auctions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get auction to verify ownership
    const auctionService = new AuctionService();
    const auction = await auctionService.getAuction(params.id);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only update your own auctions' },
        { status: 403 }
      );
    }

    // Parse update data
    const body = await request.json();
    const dto: UpdateAuctionDto = {};

    if (body.title) dto.title = body.title;
    if (body.description !== undefined) dto.description = body.description;
    if (body.status) dto.status = body.status;

    const result = await auctionService.updateAuction(params.id, dto);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Auction updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/auctions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get auction to verify ownership
    const auctionService = new AuctionService();
    const auction = await auctionService.getAuction(params.id);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own auctions' },
        { status: 403 }
      );
    }

    const result = await auctionService.deleteAuction(params.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Auction deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/auctions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
