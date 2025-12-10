/**
 * Investigation script for auction 8d5d36f2-bc5f-41e3-ae6e-59c770b21d99
 * Checks auction state, video session, and winning bid details
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role';

async function investigateAuction() {
  const supabase = createServiceRoleClient();
  const auctionId = '8d5d36f2-bc5f-41e3-ae6e-59c770b21d99';

  console.log('🔍 Investigating auction:', auctionId);
  console.log('=' .repeat(80));

  // 1. Check auction completion status
  console.log('\n1️⃣ AUCTION STATUS:');
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select('*')
    .eq('id', auctionId)
    .single();

  if (auctionError) {
    console.error('❌ Error fetching auction:', auctionError);
    return;
  }

  if (!auction) {
    console.error('❌ Auction not found');
    return;
  }

  console.log({
    id: auction.id,
    title: auction.title,
    status: auction.status,
    winner_email: auction.winner_email,
    winner_name: auction.winner_name,
    winner_bid_id: auction.winner_bid_id,
    payment_captured_at: auction.payment_captured_at,
    created_at: auction.created_at,
    end_time: auction.end_time,
  });

  // 2. Check if video recording session was created
  console.log('\n2️⃣ VIDEO RECORDING SESSION:');
  const { data: videoSession, error: videoError } = await supabase
    .from('auction_videos')
    .select('*')
    .eq('auction_id', auctionId);

  if (videoError) {
    console.error('❌ Error fetching video session:', videoError);
  } else if (!videoSession || videoSession.length === 0) {
    console.error('❌ NO VIDEO SESSION FOUND - This is likely why email was not sent!');
  } else {
    console.log('✅ Video session exists:');
    videoSession.forEach((session) => {
      console.log({
        id: session.id,
        auction_id: session.auction_id,
        bid_id: session.bid_id,
        file_url: session.file_url || '(empty - not uploaded yet)',
        recording_token: session.recording_token,
        token_expires_at: session.token_expires_at,
        created_at: session.created_at,
        retake_count: session.retake_count,
      });

      // Check if token is expired
      const tokenExpiry = new Date(session.token_expires_at);
      const now = new Date();
      if (tokenExpiry < now) {
        console.log(`⚠️  TOKEN EXPIRED at ${tokenExpiry.toISOString()}`);
      } else {
        console.log(`✅ Token valid until ${tokenExpiry.toISOString()}`);
      }
    });
  }

  // 3. Check winning bid details
  console.log('\n3️⃣ WINNING BID:');
  const { data: bids, error: bidsError } = await supabase
    .from('bids')
    .select('*')
    .eq('auction_id', auctionId)
    .order('bid_amount', { ascending: false });

  if (bidsError) {
    console.error('❌ Error fetching bids:', bidsError);
  } else if (!bids || bids.length === 0) {
    console.error('❌ No bids found');
  } else {
    console.log(`Found ${bids.length} bid(s):`);
    bids.forEach((bid, index) => {
      console.log(`\nBid #${index + 1}:`);
      console.log({
        id: bid.id,
        bidder_email: bid.bidder_email,
        bidder_name: bid.bidder_name,
        bid_amount: `$${bid.bid_amount}`,
        status: bid.status,
        payment_intent_status: bid.payment_intent_status,
        contact_method: bid.contact_method,
        whatsapp_number: bid.whatsapp_number,
        placed_at: bid.placed_at,
      });

      // Check if this is a placeholder email (WhatsApp bidder)
      if (bid.bidder_email.includes('noemail+')) {
        console.log('⚠️  This is a WhatsApp bidder (placeholder email)');
        console.log(`   WhatsApp: ${bid.whatsapp_number}`);
      }
    });

    // Find captured bid
    const capturedBid = bids.find((b) => b.status === 'captured');
    if (capturedBid) {
      console.log('\n✅ CAPTURED (WINNING) BID:');
      console.log({
        id: capturedBid.id,
        email: capturedBid.bidder_email,
        name: capturedBid.bidder_name,
        amount: `$${capturedBid.bid_amount}`,
        contact_method: capturedBid.contact_method,
      });
    } else {
      console.log('\n❌ No captured bid found!');
    }
  }

  // 4. Summary and diagnosis
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSIS:');
  console.log('=' .repeat(80));

  const hasVideoSession = videoSession && videoSession.length > 0;
  const hasCapturedBid = bids && bids.some((b) => b.status === 'captured');

  if (!hasVideoSession) {
    console.log('❌ ISSUE: No video session was created');
    console.log('   → This prevented the winner email from being sent');
    console.log('   → Likely cause: Video service failure or RLS policy issue');
  }

  if (!hasCapturedBid) {
    console.log('❌ ISSUE: No captured bid found');
    console.log('   → Payment may have failed');
  }

  if (auction.status !== 'completed') {
    console.log(`❌ ISSUE: Auction status is '${auction.status}', not 'completed'`);
  }

  if (!auction.winner_email) {
    console.log('❌ ISSUE: No winner email recorded in auction');
  }

  // Recommendations
  console.log('\n💡 RECOMMENDED ACTIONS:');
  if (!hasVideoSession && hasCapturedBid) {
    console.log('1. Create video recording session manually');
    console.log('2. Send winner email with new recording token');
    console.log('3. Extend token expiry to give winner full 24 hours');
  }

  console.log('\n✅ Investigation complete');
}

// Run investigation
investigateAuction().catch(console.error);
