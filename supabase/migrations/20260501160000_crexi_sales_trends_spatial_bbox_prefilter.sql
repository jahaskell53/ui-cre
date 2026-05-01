-- Add an explicit bbox prefilter to Crexi spatial sales-trends RPCs.
--
-- Step 1 of a two-step optimization: ensure the planner uses
-- crexi_api_comps_geom_idx (GiST) by writing the spatial join as
-- `c.geom && x.geom AND ST_Within(c.geom, x.geom)` instead of bare ST_Within.
-- This was sufficient for county and neighborhood scale, but the SF Bay Area
-- MSA polygon still ran 40-60s due to ST_Within's edge-walk cost on 139k
-- candidate points; that is fixed in 20260501170000_crexi_sales_trends_st_covers.sql.
--
-- Function-level statement_timeout is restated inline so the SET option
-- survives this CREATE OR REPLACE (forgetting that clause in
-- 20260430200000_crexi_sales_trends_exclude_split_duplicates.sql is what
-- caused the original 57014 regression).

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
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON c.geom && cb.geom
   AND ST_Within(c.geom, cb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
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
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON c.geom && n.geom
   AND ST_Within(c.geom, n.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
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
SET statement_timeout = '120s'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON c.geom && mb.geom
   AND ST_Within(c.geom, mb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;
