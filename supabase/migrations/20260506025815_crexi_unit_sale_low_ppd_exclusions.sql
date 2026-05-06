-- Tighten Crexi apartment sales-trend inputs after investigating low
-- price-per-door rows.
--
-- 1) Preserve search-index unit counts when detail enrichment overwrote them
--    with an obvious apartment-sale overcount. The search payload's
--    propertyAttributes.unitsCount is the documented source for num_units; the
--    detail payload can report square-footage-like values in numberOfUnits.
-- 2) Soft-exclude likely individual condo/apartment sales that do not expose
--    raw_json.address[0].unitNumber. These rows have single-unit sale prices
--    but building/complex-level unit counts, so they distort
--    property_price_total / num_units sales-trend math.

SET statement_timeout = 0;
SET work_mem = '256MB';

WITH parsed_raw_units AS (
    SELECT
        c.id,
        c.num_units,
        (r.raw_json #>> '{propertyAttributes,unitsCount}')::numeric AS raw_units_count
    FROM public.crexi_api_comps AS c
    JOIN public.crexi_api_comp_raw_json AS r
        ON r.crexi_id = c.crexi_id
    WHERE c.is_sales_comp = true
      AND c.property_type = 'Multifamily'
      AND c.property_subtype = 'Apartment Building'
      AND c.num_units IS NOT NULL
      AND r.raw_json #>> '{propertyAttributes,unitsCount}' ~ '^[0-9]+(\.[0-9]+)?$'
),
raw_units AS (
    SELECT id, raw_units_count::integer AS raw_units_count
    FROM parsed_raw_units
    WHERE raw_units_count BETWEEN 2 AND 500
      AND raw_units_count = trunc(raw_units_count)
      AND num_units > raw_units_count * 10
)
UPDATE public.crexi_api_comps AS c
SET num_units = ru.raw_units_count
FROM raw_units AS ru
WHERE c.id = ru.id;

UPDATE public.crexi_api_comps AS c
SET exclude_from_sales_trends = true
WHERE c.is_sales_comp = true
  AND c.property_type = 'Multifamily'
  AND c.property_subtype = 'Apartment Building'
  AND c.property_price_total IS NOT NULL
  AND c.property_price_total > 0
  AND c.num_units IS NOT NULL
  AND c.num_units >= 50
  AND c.building_sqft IS NULL
  AND c.property_price_total < 3000000
  AND c.property_price_total / c.num_units::numeric < 50000
  AND c.exclude_from_sales_trends = false;
