-- Create beauty_businesses table for reusable business profiles
-- Businesses can be linked to multiple auctions

-- Create beauty_businesses table
CREATE TABLE IF NOT EXISTS beauty_businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    instagram_handle VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    business_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_creator_business_name UNIQUE(creator_id, business_name)
);

-- Enable Row Level Security
ALTER TABLE beauty_businesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own businesses
CREATE POLICY "Users can view own businesses" ON beauty_businesses
    FOR SELECT USING (auth.uid()::text = creator_id::text);

CREATE POLICY "Users can insert own businesses" ON beauty_businesses
    FOR INSERT WITH CHECK (auth.uid()::text = creator_id::text);

CREATE POLICY "Users can update own businesses" ON beauty_businesses
    FOR UPDATE USING (auth.uid()::text = creator_id::text);

CREATE POLICY "Users can delete own businesses" ON beauty_businesses
    FOR DELETE USING (auth.uid()::text = creator_id::text);

-- Add business_id to auctions table for linking
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES beauty_businesses(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_auctions_business_id ON auctions(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_beauty_businesses_creator_id ON beauty_businesses(creator_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_beauty_business_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER beauty_businesses_updated_at
    BEFORE UPDATE ON beauty_businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_beauty_business_updated_at();
