/**
 * POST /api/auctions/[id]/video/upload
 * Upload winner video recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';
import { validateVideoFile } from '@/lib/models/AuctionVideo.model';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const videoFile = formData.get('video') as File | null;
    const bidId = formData.get('bid_id') as string;
    const recordingMethod = formData.get('recording_method') as 'in_page' | 'email_link';
    const recordingToken = formData.get('recording_token') as string | null;

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    if (!bidId) {
      return NextResponse.json(
        { error: 'Missing bid_id' },
        { status: 400 }
      );
    }

    // Validate video file
    const validation = validateVideoFile(videoFile);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // If token provided, validate it
    const videoService = new AuctionVideoService();
    if (recordingToken) {
      const tokenValidation = await videoService.validateToken(recordingToken);
      if (!tokenValidation.valid) {
        return NextResponse.json(
          { error: tokenValidation.error },
          { status: 401 }
        );
      }

      // Ensure token matches auction and bid
      if (
        tokenValidation.auction_id !== params.id ||
        tokenValidation.bid_id !== bidId
      ) {
        return NextResponse.json(
          { error: 'Token does not match auction/bid' },
          { status: 403 }
        );
      }
    }

    // Upload video
    const result = await videoService.uploadVideo({
      auction_id: params.id,
      bid_id: bidId,
      file: videoFile,
      recording_method: recordingMethod || 'in_page',
      recording_token: recordingToken || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        video_id: result.video_id,
        file_url: result.file_url,
        message: 'Video uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/auctions/[id]/video/upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
