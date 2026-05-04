-- Exclude per-unit condo/apartment sales from Crexi sales trends.
--
-- Rationale
-- ─────────
-- Crexi's search API returns one row per APN. For buildings sold unit-by-unit,
-- each unit gets its own row, but `propertyAttributes.unitsCount` is the
-- WHOLE BUILDING's unit count. The scraper writes that field into `num_units`,
-- so per-unit rows end up with:
--   - property_price_total = single-unit sale price
--   - num_units            = whole-building unit count
-- which breaks every `property_price_total / num_units` price-per-door
-- calculation in the sales-trend RPCs (example: 700 BALTIC CIR UNIT 704 sold
-- for $224K but computes to $1,836/door instead of $224K/door because
-- num_units=122).
--
-- Detector
-- ────────
-- `raw_json -> 'address' -> 0 ->> 'unitNumber' IS NOT NULL` reliably flags
-- rows that represent a single-unit sale (~40k rows, ~24% of the Crexi
-- sales-trend universe).
--
-- Product decision: condo/individual-unit sales are not relevant to the
-- mid-market multifamily use case, so we exclude them from sales trends
-- rather than rescaling their num_units. Whole-building sales are unaffected.
--
-- The `supabase db push` migrations role has a 2-minute statement_timeout,
-- and the UPDATE below is a seq scan over 287k rows with JSONB path
-- extraction plus index maintenance on the partial
-- `crexi_api_comps_sales_trends_geom_idx` GiST index (which filters on
-- `NOT exclude_from_sales_trends`, so every flipped row triggers an index
-- delete). That exceeded the 2-min budget on the first apply attempt.
-- Disable the timeout for the rest of this connection.
--
-- NOTE: this file historically used `SET LOCAL`, but `supabase db push` does
-- not wrap each migration file in an explicit transaction — it executes
-- statements in autocommit mode — so `SET LOCAL` is silently dropped with
-- `WARNING (25P01): SET LOCAL can only be used in transaction blocks`. The
-- UPDATE below previously happened to fit inside 2 minutes (small partial
-- GiST index, prior partial flips), but the pattern was not actually
-- disabling the timeout. Session-level `SET` reliably does.

SET statement_timeout = 0;

UPDATE public.crexi_api_comps
SET exclude_from_sales_trends = true
WHERE raw_json -> 'address' -> 0 ->> 'unitNumber' IS NOT NULL
  AND exclude_from_sales_trends = false;
