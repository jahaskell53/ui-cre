-- Paginated Crexi API comps for a chart bucket (matches get_crexi_sales_trends*_v2 filters
-- and the sample-window date range used by the analytics sales trends chart).

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_bucket_listings(
  p_area_kind          text,
  p_bucket_start       date,
  p_months_per_bucket  integer DEFAULT 1,
  p_offset             integer DEFAULT 0,
  p_limit              integer DEFAULT 50,
  p_zip                text    DEFAULT NULL,
  p_city               text    DEFAULT NULL,
  p_state              text    DEFAULT NULL,
  p_county_name        text    DEFAULT NULL,
  p_geoid              text    DEFAULT NULL,
  p_neighborhood_ids   integer[] DEFAULT NULL,
  p_min_units          integer DEFAULT NULL,
  p_max_units          integer DEFAULT NULL
)
RETURNS TABLE(
  id                            bigint,
  crexi_id                      text,
  property_name                 text,
  address_full                  text,
  city                          text,
  state                         text,
  zip                           text,
  property_price_total          double precision,
  num_units                     integer,
  price_per_door                double precision,
  sale_transaction_date         text,
  sale_cap_rate_percent         double precision,
  financials_cap_rate_percent   double precision,
  total_count                   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
WITH bounds AS (
  SELECT
    p_bucket_start AS window_start,
    (p_bucket_start + (GREATEST(1, COALESCE(p_months_per_bucket, 1)) || ' months')::interval)::date AS window_end
),
base AS (
  SELECT
    c.id,
    c.crexi_id,
    c.property_name,
    c.address_full,
    c.city,
    c.state,
    c.zip,
    c.property_price_total,
    c.num_units,
    (c.property_price_total / c.num_units::double precision) AS price_per_door,
    c.sale_transaction_date,
    c.sale_cap_rate_percent,
    c.financials_cap_rate_percent
  FROM crexi_api_comps c
  CROSS JOIN bounds b
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.sale_transaction_date::date >= b.window_start
    AND c.sale_transaction_date::date < b.window_end
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
    AND (
      (p_area_kind = 'zip' AND p_zip IS NOT NULL AND c.zip = p_zip)
      OR (
        p_area_kind = 'city'
        AND p_city IS NOT NULL
        AND p_state IS NOT NULL
        AND c.city ILIKE p_city
        AND c.state ILIKE p_state
      )
      OR (
        p_area_kind = 'county'
        AND p_county_name IS NOT NULL
        AND p_state IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM county_boundaries cb
          WHERE
            ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
            AND cb.name_lsad ILIKE p_county_name
            AND cb.state = p_state
        )
      )
      OR (
        p_area_kind = 'neighborhood'
        AND p_neighborhood_ids IS NOT NULL
        AND c.latitude IS NOT NULL
        AND c.longitude IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM neighborhoods n
          WHERE
            ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
            AND n.id = ANY(p_neighborhood_ids)
        )
      )
      OR (
        p_area_kind = 'msa'
        AND p_geoid IS NOT NULL
        AND c.latitude IS NOT NULL
        AND c.longitude IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM msa_boundaries mb
          WHERE
            ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
            AND mb.geoid = p_geoid
        )
      )
    )
),
numbered AS (
  SELECT
    base.*,
    COUNT(*) OVER () AS total_count
  FROM base
)
SELECT
  n.id,
  n.crexi_id,
  n.property_name,
  n.address_full,
  n.city,
  n.state,
  n.zip,
  n.property_price_total,
  n.num_units,
  n.price_per_door,
  n.sale_transaction_date,
  n.sale_cap_rate_percent,
  n.financials_cap_rate_percent,
  n.total_count
FROM numbered n
ORDER BY n.sale_transaction_date::date DESC, n.id DESC
OFFSET GREATEST(0, COALESCE(p_offset, 0))
LIMIT LEAST(200, GREATEST(1, COALESCE(p_limit, 50)));
$function$;
