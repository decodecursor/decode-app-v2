-- Add winner Instagram username column to auctions table
-- This stores the winning bidder's Instagram handle for creator contact purposes

ALTER TABLE auctions
ADD COLUMN winner_instagram_username VARCHAR(30);

-- Add comment to document the column
COMMENT ON COLUMN auctions.winner_instagram_username IS 'Instagram username of the auction winner (copied from winning bid)';
