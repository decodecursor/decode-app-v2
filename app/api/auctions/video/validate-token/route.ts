/**
 * API Route: Validate Video Recording Token
 * POST /api/auctions/video/validate-token
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionVideoService } from '@/lib/services/AuctionVideoService';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const videoService = new AuctionVideoService();
    const result = await videoService.validateToken(token);

    if (!result.valid) {
      // Special handling for already uploaded videos
      if (result.already_uploaded) {
        return NextResponse.json(
          {
            success: true,
            valid: false,
            already_uploaded: true,
            auction_id: result.auction_id,
            bid_id: result.bid_id,
            error: result.error || 'Video already uploaded',
          },
          { status: 200 } // 200 not 400, since this is a "success" state (video was uploaded)
        );
      }

      return NextResponse.json(
        {
          success: false,
          valid: false,
          already_uploaded: false,
          error: result.error || 'Invalid or expired token',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      already_uploaded: false,
      auction_id: result.auction_id,
      bid_id: result.bid_id,
      creator_name: result.creator_name,
      token_expires_at: result.token_expires_at,
    });
  } catch (error) {
    console.error('❌ Error validating token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}
