-- Exclude likely per-unit apartment sales that lack address.unitNumber but still
-- carry whole-building num_units with a single-unit total price, which skews
-- price-per-door medians downward. Keeps the existing unitNumber-based rule.
--
-- Match scraper logic in scripts/scrape_crexi.sh (exclude_from_sales_trends).
-- `raw_json` lives on `crexi_api_comp_raw_json` after 20260503234944.

SET statement_timeout = 0;

UPDATE public.crexi_api_comps c
SET exclude_from_sales_trends = true
WHERE c.exclude_from_sales_trends = false
  AND EXISTS (
    SELECT 1
    FROM public.crexi_api_comp_raw_json r
    WHERE r.crexi_id = c.crexi_id
      AND (r.raw_json -> 'address' -> 0 ->> 'unitNumber') IS NULL
  )
  AND c.property_type = 'Multifamily'
  AND c.property_subtype = 'Apartment Building'
  AND c.building_sqft IS NULL
  AND c.num_units >= 50
  AND c.property_price_total IS NOT NULL
  AND c.property_price_total < 3000000
  AND (c.property_price_total::double precision / c.num_units::double precision) < 50000;
