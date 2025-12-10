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

    // Get video record (may exist without file_url for countdown purposes)
    const videoService = new AuctionVideoService();
    const video = await videoService.getVideo(params.id);

    // If no video record at all, return 404
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // If video record exists but no file uploaded yet, return countdown data only
    if (!video.file_url || video.file_url.trim() === '') {
      return NextResponse.json({
        success: true,
        video: {
          id: video.id,
          token_expires_at: video.token_expires_at,
          file_url: null, // No video uploaded yet
        },
        winner: {
          name: auction.winner_name,
          instagram_username: auction.winner_instagram_username,
        },
      });
    }

    // Extract file path from stored URL and generate signed URL for private bucket
    const filePath = video.file_url.match(/auction-videos\/.+$/)?.[0];
    if (!filePath) {
      console.error('Invalid video path:', video.file_url);
      return NextResponse.json({ error: 'Invalid video path' }, { status: 500 });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from('auction_videos')
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedUrlData?.signedUrl) {
      console.error('Failed to generate signed URL:', signedError);
      return NextResponse.json({ error: 'Failed to generate video URL' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        file_url: signedUrlData.signedUrl,
        file_size_bytes: video.file_size_bytes,
        duration_seconds: video.duration_seconds,
        mime_type: video.mime_type,
        created_at: video.created_at,
        expires_at: video.expires_at,
        watched_to_end_at: video.watched_to_end_at,
        payout_unlocked_at: video.payout_unlocked_at,
        retake_count: video.retake_count,
      },
      winner: {
        name: auction.winner_name,
        instagram_username: auction.winner_instagram_username,
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
