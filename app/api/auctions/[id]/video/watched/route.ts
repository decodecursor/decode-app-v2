/**
 * POST /api/auctions/[id]/video/watched
 * Record that model watched video to completion (unlocks payout)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { AuctionService } from '@/lib/services/AuctionService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get auction to verify ownership
    const auctionService = new AuctionService();
    const auction = await auctionService.getAuction(params.id);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Only auction creator can mark video as watched' },
        { status: 403 }
      );
    }

    // Use service role to bypass RLS for update
    const serviceClient = createServiceRoleClient();

    // Get video record
    const { data: video, error: videoError } = await serviceClient
      .from('auction_videos')
      .select('id, file_url, watched_to_end_at, payout_unlocked_at')
      .eq('auction_id', params.id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check video was actually uploaded
    if (!video.file_url) {
      return NextResponse.json(
        { error: 'No video has been uploaded yet' },
        { status: 400 }
      );
    }

    // Check if already watched (idempotent - return success)
    if (video.watched_to_end_at) {
      return NextResponse.json({
        success: true,
        already_watched: true,
        watched_at: video.watched_to_end_at,
        payout_unlocked_at: video.payout_unlocked_at,
      });
    }

    // Mark as watched and unlock payout
    const now = new Date().toISOString();
    const { error: updateError } = await serviceClient
      .from('auction_videos')
      .update({
        watched_to_end_at: now,
        payout_unlocked_at: now,
      })
      .eq('id', video.id);

    if (updateError) {
      console.error('Error updating video watch status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update video status' },
        { status: 500 }
      );
    }

    console.log(`✅ Video watched to end for auction ${params.id} - payout unlocked`);

    return NextResponse.json({
      success: true,
      watched_at: now,
      payout_unlocked_at: now,
    });
  } catch (error) {
    console.error('Error in POST /api/auctions/[id]/video/watched:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
