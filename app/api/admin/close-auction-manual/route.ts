/**
 * POST /api/admin/close-auction-manual
 * Manual auction close endpoint for when EventBridge fails to trigger
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { auctionId } = await request.json();

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Missing auctionId' },
        { status: 400 }
      );
    }

    console.log(`[ManualClose] Manually closing auction: ${auctionId}`);

    const eventBridgePayload = {
      auctionId,
      source: 'eventbridge-scheduler',
      scheduledTime: new Date().toISOString()
    };

    const eventBridgeUrl = `${request.nextUrl.origin}/api/auctions/eventbridge/close`;

    const response = await fetch(eventBridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBridgePayload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'EventBridge close failed');
    }

    console.log(`[ManualClose] Successfully closed auction: ${auctionId}`);

    return NextResponse.json({
      success: true,
      message: 'Auction closed manually',
      auction_id: auctionId,
      result: data
    });
  } catch (error) {
    console.error('[ManualClose] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close auction'
      },
      { status: 500 }
    );
  }
}
