-- Fix Crexi spatial RPCs so PostgREST can load them.
--
-- The inline `SET statement_timeout = '30s'` option in LANGUAGE sql functions
-- breaks PostgREST's schema cache introspection, causing ALL RPCs to return
-- PGRST002. Recreate the three spatial functions without the inline SET, then
-- apply the timeout via ALTER FUNCTION (the pattern used everywhere else in
-- this codebase, e.g. 20260410060000_remaining_rpcs_statement_timeout.sql).

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
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

ALTER FUNCTION public.get_crexi_sales_trends_by_county(text, text)
    SET statement_timeout TO '60s';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood(integer[])
    SET statement_timeout TO '60s';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa(text)
    SET statement_timeout TO '60s';
