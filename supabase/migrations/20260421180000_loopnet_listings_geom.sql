-- Add geom (PostGIS Point) column to loopnet_listings.
-- Rows that already have latitude/longitude are backfilled immediately.
-- The Dagster backfill_loopnet_geom_job geocodes rows where geom is still NULL.

ALTER TABLE "loopnet_listings"
  ADD COLUMN IF NOT EXISTS "geom" public.geometry(Point, 4326);

-- Backfill from existing lat/lng where both are present.
UPDATE "loopnet_listings"
SET "geom" = ST_SetSRID(ST_Point(longitude, latitude), 4326)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND geom IS NULL;

CREATE INDEX IF NOT EXISTS idx_loopnet_listings_geom
  ON public.loopnet_listings
  USING gist (geom)
  WHERE geom IS NOT NULL;
