-- Add unit-count filters (p_min_units, p_max_units) and additional price
-- aggregation columns (avg_price, p25_price, p75_price) to all five Crexi
-- sales trend time-series RPCs.
--
-- These are new "v2" functions that coexist with the originals.  The v1
-- functions are not changed so existing callers are unaffected.
--
-- Return shape adds:
--   avg_price   — AVG(price_per_door)
--   p25_price   — 25th percentile of price_per_door
--   p75_price   — 75th percentile of price_per_door
--
-- Unit filter semantics:
--   p_min_units / p_max_units default to NULL (no filter).

-- ── 1. ZIP ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_v2(
  p_zip        text    DEFAULT NULL,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(property_price_total / num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
    AND (p_min_units IS NULL OR num_units >= p_min_units)
    AND (p_max_units IS NULL OR num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 2. City ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city_v2(
  p_city       text,
  p_state      text,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(property_price_total / num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND city ILIKE p_city
    AND state ILIKE p_state
    AND (p_min_units IS NULL OR num_units >= p_min_units)
    AND (p_max_units IS NULL OR num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 3. County ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county_v2(
  p_county_name text,
  p_state       text,
  p_min_units   integer DEFAULT NULL,
  p_max_units   integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 4. Neighborhood ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_neighborhood_v2(
  p_neighborhood_ids integer[],
  p_min_units        integer DEFAULT NULL,
  p_max_units        integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 5. MSA ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa_v2(
  p_geoid      text,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
)
RETURNS TABLE(
  month_start   date,
  median_price  numeric,
  avg_price     numeric,
  p25_price     numeric,
  p75_price     numeric,
  avg_cap_rate  numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND mb.geoid = p_geoid
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;
