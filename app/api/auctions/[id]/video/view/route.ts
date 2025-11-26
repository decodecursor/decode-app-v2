/**
 * GET /api/auctions/[id]/video/view
 * View auction video (creator only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';
import { AuctionService } from '@/lib/services/AuctionService';

export async function GET(
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
        { error: 'Only auction creator can view videos' },
        { status: 403 }
      );
    }

    // Get video
    const videoService = new AuctionVideoService();
    const video = await videoService.getVideo(params.id);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        file_url: video.file_url,
        file_size_bytes: video.file_size_bytes,
        duration_seconds: video.duration_seconds,
        mime_type: video.mime_type,
        created_at: video.created_at,
        expires_at: video.expires_at,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/auctions/[id]/video/view:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
