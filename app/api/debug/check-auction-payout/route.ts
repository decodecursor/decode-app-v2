/**
 * POST /api/debug/check-auction-payout
 * Diagnostic endpoint to check auction and payout status
 * Admin only - helps diagnose missing payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const { auction_title } = body;

    if (!auction_title) {
      return NextResponse.json(
        { error: 'Missing auction_title parameter' },
        { status: 400 }
      );
    }

    // Find auction by title
    const { data: auctions, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        id,
        title,
        status,
        auction_start_price,
        auction_current_price,
        total_bids,
        creator_id,
        winner_bid_id,
        winner_email,
        winner_name,
        payment_captured_at,
        created_at,
        end_time,
        start_time
      `)
      .ilike('title', `%${auction_title}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (auctionError) {
      return NextResponse.json(
        { error: 'Failed to fetch auctions', details: auctionError },
        { status: 500 }
      );
    }

    if (!auctions || auctions.length === 0) {
      return NextResponse.json({
        message: 'No auctions found',
        auction_title,
      });
    }

    // For each auction, check for payouts
    const results = await Promise.all(
      auctions.map(async (auction) => {
        // Check for payout record
        const { data: payout, error: payoutError } = await supabase
          .from('auction_payouts')
          .select('*')
          .eq('auction_id', auction.id)
          .single();

        // Check for bids
        const { data: bids, error: bidsError } = await supabase
          .from('bids')
          .select('id, bid_amount, status, bidder_name, bidder_email, created_at')
          .eq('auction_id', auction.id)
          .order('bid_amount', { ascending: false })
          .limit(3);

        // Calculate expected payout amounts
        const winningAmount = Number(auction.auction_current_price);
        const startPrice = Number(auction.auction_start_price);
        const profit = winningAmount - startPrice;
        const platformFee = profit > 0 ? profit * 0.25 : 0;
        const modelAmount = winningAmount - platformFee;

        return {
          auction: {
            id: auction.id,
            title: auction.title,
            status: auction.status,
            start_price: startPrice,
            current_price: winningAmount,
            total_bids: auction.total_bids,
            winner_bid_id: auction.winner_bid_id,
            payment_captured_at: auction.payment_captured_at,
            created_at: auction.created_at,
            end_time: auction.end_time,
          },
          calculated_amounts: {
            winning_amount: winningAmount,
            start_price: startPrice,
            profit,
            platform_fee: platformFee,
            model_amount: modelAmount,
          },
          payout: payout || null,
          payout_exists: !!payout,
          payout_error: payoutError?.message || null,
          top_bids: bids || [],
          diagnosis: {
            has_bids: (bids?.length || 0) > 0,
            payment_captured: !!auction.payment_captured_at,
            payout_created: !!payout,
            auction_completed: auction.status === 'completed',
            auction_ended: auction.status === 'ended',
            likely_issue: !payout
              ? 'NO_PAYOUT_RECORD'
              : payout.status !== 'pending'
              ? 'PAYOUT_STATUS_NOT_PENDING'
              : 'UNKNOWN',
          },
        };
      })
    );

    return NextResponse.json({
      success: true,
      search_term: auction_title,
      found_count: auctions.length,
      results,
    });
  } catch (error) {
    console.error('Error in check-auction-payout:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
