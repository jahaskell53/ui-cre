-- Align loopnet_listings with cleaned_listings address column naming.
ALTER TABLE "loopnet_listings"
  ADD COLUMN IF NOT EXISTS "address_raw" text,
  ADD COLUMN IF NOT EXISTS "address_street" text,
  ADD COLUMN IF NOT EXISTS "address_city" text,
  ADD COLUMN IF NOT EXISTS "address_state" text,
  ADD COLUMN IF NOT EXISTS "address_zip" text;

CREATE INDEX IF NOT EXISTS idx_loopnet_listings_address_city_state_lower
  ON public.loopnet_listings (lower(address_city), lower(address_state));
