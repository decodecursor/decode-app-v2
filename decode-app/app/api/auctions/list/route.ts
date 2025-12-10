/**
 * GET /api/auctions/list
 * List all auctions with optional filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionService } from '@/lib/services/AuctionService';
import type { AuctionStatus } from '@/lib/models/Auction.model';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get('status') as AuctionStatus | null;
    const creator_id = searchParams.get('creator_id');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const auctionService = new AuctionService();

    const auctions = await auctionService.listAuctions({
      status: status || undefined,
      creator_id: creator_id || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      auctions,
      count: auctions.length,
    });
  } catch (error) {
    console.error('Error in GET /api/auctions/list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
