/**
 * POST /api/auctions/[id]/bid
 * Place a bid on an auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BiddingService } from '@/lib/services/BiddingService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated (optional for guest bidding)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.bidder_name || !body.amount || !body.contact_method) {
      return NextResponse.json(
        { error: 'Missing required fields: bidder_name, amount, contact_method' },
        { status: 400 }
      );
    }

    // Validate contact method
    if (!['email', 'whatsapp'].includes(body.contact_method)) {
      return NextResponse.json(
        { error: 'Invalid contact method. Must be "email" or "whatsapp"' },
        { status: 400 }
      );
    }

    // Validate contact info based on method
    if (body.contact_method === 'email') {
      if (!body.bidder_email) {
        return NextResponse.json(
          { error: 'Email address is required when contact method is email' },
          { status: 400 }
        );
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.bidder_email)) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        );
      }
    } else if (body.contact_method === 'whatsapp') {
      if (!body.whatsapp_number) {
        return NextResponse.json(
          { error: 'WhatsApp number is required when contact method is whatsapp' },
          { status: 400 }
        );
      }
      // Validate phone number format (should include country code)
      const phoneRegex = /^\+[0-9]{1,4}[0-9]{7,15}$/;
      if (!phoneRegex.test(body.whatsapp_number)) {
        return NextResponse.json(
          { error: 'Invalid WhatsApp number format. Must include country code (e.g., +971501234567)' },
          { status: 400 }
        );
      }
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
    const bidData: any = {
      auction_id: params.id,
      bidder_name: body.bidder_name.trim(),
      contact_method: body.contact_method,
      amount,
      is_guest: !user,
      user_id: user?.id,
      ip_address,
      user_agent,
    };

    // Add contact info based on method
    if (body.contact_method === 'email') {
      bidData.bidder_email = body.bidder_email.toLowerCase().trim();
    } else if (body.contact_method === 'whatsapp') {
      bidData.whatsapp_number = body.whatsapp_number;
      // For backward compatibility, also set bidder_email with whatsapp prefix
      bidData.bidder_email = `whatsapp:${body.whatsapp_number}`;
    }

    const result = await biddingService.placeBid(bidData);

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
