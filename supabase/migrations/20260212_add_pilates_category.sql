ALTER TABLE beauty_offers DROP CONSTRAINT beauty_offers_category_check;
ALTER TABLE beauty_offers ADD CONSTRAINT beauty_offers_category_check
  CHECK (category = ANY (ARRAY['aesthetics','hair','nails','spa','pilates']));
