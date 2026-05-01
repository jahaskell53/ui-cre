-- Use GiST bbox prefilter (geom && geom) before ST_Within so county/MSA scans use
-- crexi_api_comps_geom_idx. Nested-loop ST_Within without && timed out at 120s on production.

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM county_boundaries cb
  INNER JOIN crexi_api_comps c
    ON c.geom IS NOT NULL
    AND cb.geom && c.geom
    AND ST_Within(c.geom, cb.geom)
  WHERE
    cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa(
  p_geoid text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM msa_boundaries mb
  INNER JOIN crexi_api_comps c
    ON c.geom IS NOT NULL
    AND mb.geom && c.geom
    AND ST_Within(c.geom, mb.geom)
  WHERE
    mb.geoid = p_geoid
    AND c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$function$;

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
  FROM county_boundaries cb
  INNER JOIN crexi_api_comps c
    ON c.geom IS NOT NULL
    AND cb.geom && c.geom
    AND ST_Within(c.geom, cb.geom)
  WHERE
    cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

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
  FROM msa_boundaries mb
  INNER JOIN crexi_api_comps c
    ON c.geom IS NOT NULL
    AND mb.geom && c.geom
    AND ST_Within(c.geom, mb.geom)
  WHERE
    mb.geoid = p_geoid
    AND c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND (p_min_units IS NULL OR c.num_units >= p_min_units)
    AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;
