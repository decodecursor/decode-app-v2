-- Enable full row data in Supabase Realtime UPDATE events for bids table
-- This ensures that when a bid is updated, the realtime subscription receives
-- the complete updated row data in payload.new, not just the primary key.
-- This is critical for real-time leaderboard updates to work properly.

ALTER TABLE bids REPLICA IDENTITY FULL;
