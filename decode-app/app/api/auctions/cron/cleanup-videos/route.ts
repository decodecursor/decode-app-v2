/**
 * POST /api/auctions/cron/cleanup-videos
 * Cron job to delete expired videos (7-day cleanup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videoService = new AuctionVideoService();
    const result = await videoService.deleteExpiredVideos();

    return NextResponse.json({
      success: true,
      deleted_count: result.deleted_count,
      message: `Deleted ${result.deleted_count} expired videos`,
    });
  } catch (error) {
    console.error('Error in POST /api/auctions/cron/cleanup-videos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
