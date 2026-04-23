-- PR 2: Remove redundant raw city/state on LoopNet detail tables.
-- Address normalization uses address_raw, location, and zip; pipeline backfill no longer reads city/state.

ALTER TABLE public.loopnet_listing_details
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS state;

ALTER TABLE public.loopnet_listings_archived
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS state;
