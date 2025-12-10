-- Add Instagram username column to bids table
-- This allows bidders to optionally provide their Instagram handle

ALTER TABLE bids
ADD COLUMN bidder_instagram_username VARCHAR(30);

-- Add comment to document the column
COMMENT ON COLUMN bids.bidder_instagram_username IS 'Optional Instagram username of the bidder (without @ symbol)';

-- Create index for Instagram username lookups (optional but useful for future queries)
CREATE INDEX idx_bids_instagram_username ON bids(bidder_instagram_username) WHERE bidder_instagram_username IS NOT NULL;
