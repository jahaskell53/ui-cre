-- Add geom column to crexi_api_comps and update spatial RPCs to use it.
--
-- A stored geometry(Point, 4326) column with a real GiST index is far faster
-- than the functional expression ST_SetSRID(ST_Point(longitude, latitude), 4326)
-- used in the initial Crexi RPCs. This matches the pattern used in
-- loopnet_listing_details.geom.

-- 1. Add the column.
ALTER TABLE public.crexi_api_comps
    ADD COLUMN IF NOT EXISTS geom public.geometry(Point, 4326);

-- 2. Backfill from existing lat/lng.
UPDATE public.crexi_api_comps
SET geom = ST_SetSRID(ST_Point(longitude, latitude), 4326)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND geom IS NULL;

-- 3. Real GiST index on the stored column.
DROP INDEX IF EXISTS public.crexi_api_comps_geom_idx;

CREATE INDEX IF NOT EXISTS crexi_api_comps_geom_idx
    ON public.crexi_api_comps
    USING gist (geom)
    WHERE geom IS NOT NULL;

-- 4. Rewrite spatial RPCs to use c.geom directly.

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(c.geom, cb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_neighborhood(
  p_neighborhood_ids integer[]
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(c.geom, n.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa(
  p_geoid text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(c.geom, mb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;
