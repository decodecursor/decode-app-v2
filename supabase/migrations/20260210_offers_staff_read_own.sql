-- Staff/Admin can read ALL their own business offers (any status)
-- Without this, Staff can only see active+non-expired offers via offers_read_public
CREATE POLICY "offers_read_own_business"
ON beauty_offers FOR SELECT
USING (
  business_id IN (
    SELECT id FROM beauty_businesses WHERE creator_id = auth.uid()
  )
);
