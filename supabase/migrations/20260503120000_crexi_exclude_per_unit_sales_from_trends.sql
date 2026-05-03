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
-- Large-table UPDATE with JSON extraction can exceed the default session
-- statement_timeout (~2 min); see 20260501120000_crexi_api_comps_crexi_url.sql.

SET statement_timeout = '30min';

UPDATE public.crexi_api_comps
SET exclude_from_sales_trends = true
WHERE raw_json -> 'address' -> 0 ->> 'unitNumber' IS NOT NULL
  AND exclude_from_sales_trends = false;
