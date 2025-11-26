import { supabaseAdmin } from '../lib/supabase-admin'

async function checkAuctionPayout() {
  const auctionId = '7510194d-1f48-4472-b046-09bcf15407cb'

  const { data: auction, error } = await supabaseAdmin
    .from('auctions')
    .select('id, title, auction_start_price, auction_current_price, profit_amount, platform_fee_amount, model_payout_amount')
    .eq('id', auctionId)
    .single()

  if (error) {
    console.error('Error fetching auction:', error)
    return
  }

  console.log('\n=== Auction Payout Details ===')
  console.log(`ID: ${auction.id}`)
  console.log(`Title: ${auction.title}`)
  console.log(`\nStart Price: $${auction.auction_start_price}`)
  console.log(`Winning Bid (Current Price): $${auction.auction_current_price}`)
  console.log(`\nProfit Amount: $${auction.profit_amount}`)
  console.log(`Platform Fee (25%): $${auction.platform_fee_amount}`)
  console.log(`Model Payout: $${auction.model_payout_amount}`)

  // Verify the calculation using NEW formula
  const calculatedProfit = Number(auction.auction_current_price) - Number(auction.auction_start_price)
  const calculatedFee = calculatedProfit * 0.25
  const calculatedPayout = calculatedProfit - calculatedFee  // NEW: profit - fee, not winningBid - fee

  console.log('\n=== Verification (NEW Formula) ===')
  console.log(`Calculated Profit: $${calculatedProfit}`)
  console.log(`Calculated Fee (25%): $${calculatedFee}`)
  console.log(`Calculated Model Payout (profit - fee): $${calculatedPayout}`)
  console.log(`Expected Model Payout: $${calculatedProfit * 0.75}`)

  console.log('\n=== Match Status ===')
  console.log(`Profit matches: ${Number(auction.profit_amount) === calculatedProfit}`)
  console.log(`Fee matches: ${Number(auction.platform_fee_amount) === calculatedFee}`)
  console.log(`Payout matches: ${Number(auction.model_payout_amount) === calculatedPayout}`)
}

checkAuctionPayout()
