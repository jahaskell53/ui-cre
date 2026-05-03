-- Add detail_json and detail_enriched_at to store the full response from the
-- Crexi property detail API (GET https://api.crexi.com/properties/{id}).
-- The detail API is more accurate than the search index for num_units, building
-- details, transaction/tax/ownership history, zoning, etc.
-- detail_json: full API response stored as JSONB.
-- detail_enriched_at: timestamp set when detail_json was last fetched and
--   num_units was overwritten from detail_json->>'numberOfUnits'.
ALTER TABLE crexi_api_comps
    ADD COLUMN IF NOT EXISTS detail_json jsonb,
    ADD COLUMN IF NOT EXISTS detail_enriched_at timestamptz;
