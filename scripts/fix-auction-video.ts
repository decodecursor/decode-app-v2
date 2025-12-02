/**
 * Script to manually create video recording session for an auction
 * Run with: npx tsx scripts/fix-auction-video.ts
 */

import { supabaseAdmin } from '../lib/supabase-admin';

const AUCTION_ID = '03432062-bb63-4b6e-b57f-7d754bf614e9';

async function fixAuctionVideo() {
  console.log('🔧 Fixing video session for auction:', AUCTION_ID);

  try {
    // 1. Get auction details
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('*, creator:users!creator_id(email, user_name)')
      .eq('id', AUCTION_ID)
      .single();

    if (auctionError || !auction) {
      console.error('❌ Auction not found:', auctionError);
      return;
    }

    console.log('📋 Auction:', {
      id: auction.id,
      title: auction.title,
      status: auction.status,
      winner_email: auction.winner_email,
      has_video: auction.has_video
    });

    // 2. Get winning bid
    const { data: winningBid, error: bidError } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('auction_id', AUCTION_ID)
      .order('amount', { ascending: false })
      .limit(1)
      .single();

    if (bidError || !winningBid) {
      console.error('❌ No winning bid found:', bidError);
      return;
    }

    console.log('🏆 Winning bid:', {
      id: winningBid.id,
      email: winningBid.bidder_email,
      amount: winningBid.amount
    });

    // 3. Check if video session already exists
    const { data: existingSession } = await supabaseAdmin
      .from('auction_videos')
      .select('*')
      .eq('auction_id', AUCTION_ID)
      .single();

    if (existingSession) {
      console.log('✅ Video session already exists:', {
        token: existingSession.recording_token,
        expires: existingSession.token_expires_at,
        has_video: !!existingSession.file_url
      });

      // Check if token is expired
      const tokenExpiry = new Date(existingSession.token_expires_at);
      const now = new Date();
      if (tokenExpiry < now) {
        console.log('⚠️  Token has expired. Extending by 24 hours...');
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 24);

        await supabaseAdmin
          .from('auction_videos')
          .update({ token_expires_at: newExpiry.toISOString() })
          .eq('id', existingSession.id);

        console.log('✅ Token expiry extended to:', newExpiry.toISOString());
      }
      return;
    }

    // 4. Create new video recording session
    console.log('📹 Creating new video recording session...');

    const recordingToken = generateToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from('auction_videos')
      .insert({
        auction_id: AUCTION_ID,
        bid_id: winningBid.id,
        recording_token: recordingToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        file_url: '',
        retake_count: 0,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Failed to create session:', sessionError);
      return;
    }

    console.log('✅ Video session created!');
    console.log('');
    console.log('📧 Recording link for winner:');
    console.log(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.welovedecode.com'}/auctions/video/${recordingToken}`);
    console.log('');
    console.log('⏰ Token expires at:', tokenExpiresAt.toISOString());
    console.log('📹 Video expires at:', expiresAt.toISOString());

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

function generateToken(): string {
  const characters = '0123456789abcdef';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return token;
}

// Run the script
fixAuctionVideo();
