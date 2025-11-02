/**
 * POST /api/auctions/[id]/bid
 * Place a bid on an auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BiddingService } from '@/lib/services/BiddingService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Check if user is authenticated (optional for guest bidding)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.bidder_email || !body.bidder_name || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields: bidder_email, bidder_name, amount' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.bidder_email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate name
    if (body.bidder_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Validate amount
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid bid amount' },
        { status: 400 }
      );
    }

    // Get IP address and user agent
    const ip_address = request.headers.get('x-forwarded-for') ||
                       request.headers.get('x-real-ip') ||
                       'unknown';
    const user_agent = request.headers.get('user-agent') || 'unknown';

    // Place bid
    const biddingService = new BiddingService();
    const result = await biddingService.placeBid({
      auction_id: params.id,
      bidder_email: body.bidder_email.toLowerCase().trim(),
      bidder_name: body.bidder_name.trim(),
      amount,
      is_guest: !user,
      user_id: user?.id,
      ip_address,
      user_agent,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        bid_id: result.bid_id,
        client_secret: result.client_secret,
        message: 'Bid placed successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/auctions/[id]/bid:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
