-- Analytics RPCs used by the Next.js UI.
-- These functions are called via Supabase PostgREST RPC from:
-- - /analytics/trends (rent trends + market activity/off-market)

CREATE OR REPLACE FUNCTION public.get_rent_trends(
  p_zip text DEFAULT NULL::text,
  p_beds integer DEFAULT NULL::integer
)
RETURNS TABLE(
  week_start date,
  beds integer,
  median_rent numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_rent_trends(
  p_zip text DEFAULT NULL::text,
  p_beds integer DEFAULT NULL::integer,
  p_include_reits boolean DEFAULT true
)
RETURNS TABLE(
  week_start date,
  beds integer,
  median_rent numeric,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::numeric AS median_rent,
    COUNT(*) AS listing_count
  FROM cleaned_listings
  WHERE
    price IS NOT NULL AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_beds IS NULL OR CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END = p_beds)
    AND (p_include_reits OR building_zpid IS NULL)
  GROUP BY 1, 2
  ORDER BY 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity(
  p_zip text DEFAULT NULL::text,
  p_include_reits boolean DEFAULT true
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  off_market bigint,
  active_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH latest_week AS (
  SELECT MAX(DATE_TRUNC('week', scraped_at)::date) AS w FROM cleaned_listings
),
lifecycle AS (
  SELECT
    zpid,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    MIN(DATE_TRUNC('week', scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', scraped_at)::date) AS last_seen,
    MAX(DATE_TRUNC('week', scraped_at)::date) = (SELECT w FROM latest_week) AS is_active
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND (p_include_reits OR building_zpid IS NULL)
  GROUP BY zpid, 2
),
all_weeks AS (
  SELECT DISTINCT DATE_TRUNC('week', scraped_at)::date AS week_start
  FROM cleaned_listings
),
bed_types AS (SELECT DISTINCT beds FROM lifecycle)
SELECT
  w.week_start,
  b.beds,
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start)                    AS new_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND NOT l.is_active) AS off_market,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.is_active)   AS active_count
FROM all_weeks w
CROSS JOIN bed_types b
JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds
ORDER BY w.week_start, b.beds;
$function$;

-- Ensure PostgREST can execute these via RPC for client roles.
GRANT EXECUTE ON FUNCTION public.get_rent_trends(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rent_trends(text, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity(text, boolean) TO anon, authenticated;

