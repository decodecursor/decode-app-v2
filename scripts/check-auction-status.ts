import { createServiceRoleClient } from '../utils/supabase/service-role';

const AUCTION_ID = '03432062-bb63-4b6e-b57f-7d754bf614e9';

async function checkAuctionStatus() {
  const supabase = createServiceRoleClient();

  // Get auction
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select('id, title, status, payout_status, creator_id, payment_captured_at, model_payout_amount')
    .eq('id', AUCTION_ID)
    .single();

  console.log('\n📋 Auction Status:');
  console.log(JSON.stringify(auction, null, 2));
  if (auctionError) console.error('Error:', auctionError);

  // Get video session
  const { data: video, error: videoError } = await supabase
    .from('auction_videos')
    .select('*')
    .eq('auction_id', AUCTION_ID)
    .single();

  console.log('\n🎥 Video Session:');
  console.log(JSON.stringify(video, null, 2));
  if (videoError) console.error('Error:', videoError);

  // Check payout record
  const { data: payout, error: payoutError } = await supabase
    .from('payouts')
    .select('*')
    .eq('auction_id', AUCTION_ID)
    .single();

  console.log('\n💰 Payout Record:');
  console.log(JSON.stringify(payout, null, 2));
  if (payoutError) console.error('Error:', payoutError);
}

checkAuctionStatus();
