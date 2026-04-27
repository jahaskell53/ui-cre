-- Crexi API comps sales trends RPCs.
--
-- These mirror the existing get_sales_trends* RPC family but source data from
-- crexi_api_comps (actual closed-sale comps) instead of loopnet_listing_snapshots
-- (for-sale listing scrapes). Key differences:
--
--   • Time axis: sale_transaction_date (the actual closing date) rather than scraped_at.
--   • Price:     property_price_total (total sale price) rather than price_numeric.
--   • Cap rate:  not available in crexi_api_comps — avg_cap_rate is always NULL.
--   • Filter:    is_sales_comp = true to restrict to confirmed sales.
--   • Spatial:   built from latitude/longitude (no geom column on the table).

-- ── 1. ZIP ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends(
  p_zip text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total)::numeric AS median_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 2. City ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city(
  p_city text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total)::numeric AS median_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND sale_transaction_date IS NOT NULL
    AND city ILIKE p_city
    AND state ILIKE p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 3. County ───────────────────────────────────────────────────────────────

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
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 4. Neighborhood ─────────────────────────────────────────────────────────

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
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ── 5. MSA ──────────────────────────────────────────────────────────────────

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
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
  WHERE
    c.is_sales_comp = true
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;
