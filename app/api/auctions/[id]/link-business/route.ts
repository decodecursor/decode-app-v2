/**
 * PATCH /api/auctions/[id]/link-business
 * Link a beauty business to an auction (or unlink by passing null)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionService } from '@/lib/services/AuctionService';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔵 [API /auctions/[id]/link-business] Request received for auction:', params.id);
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [API /auctions/[id]/link-business] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    console.log('📦 [API /auctions/[id]/link-business] Request body:', body);

    const { business_id } = body;

    // Verify user is the auction creator
    const auctionService = new AuctionService();
    const auction = await auctionService.getAuction(params.id);

    if (!auction) {
      console.error('❌ [API /auctions/[id]/link-business] Auction not found');
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.creator_id !== user.id) {
      console.error('❌ [API /auctions/[id]/link-business] Unauthorized - not auction creator');
      return NextResponse.json(
        { error: 'Only the auction creator can link a business' },
        { status: 403 }
      );
    }

    // Update auction with business_id (or null to unlink)
    const result = await auctionService.updateAuction(params.id, {
      business_id: business_id || null,
    });

    if (!result.success) {
      console.error('❌ [API /auctions/[id]/link-business] Update failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log('✅ [API /auctions/[id]/link-business] Business linked successfully');
    return NextResponse.json(
      {
        success: true,
        auction_id: params.id,
        business_id: business_id || null,
        message: business_id ? 'Business linked successfully' : 'Business unlinked successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('💥 [API /auctions/[id]/link-business] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
