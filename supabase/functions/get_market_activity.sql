CREATE OR REPLACE FUNCTION public.get_market_activity(p_zip text DEFAULT NULL::text, p_reits_only boolean DEFAULT false)
 RETURNS TABLE(week_start date, beds integer, new_listings bigint, closed_listings bigint, accumulated_listings bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
WITH latest_week AS (
  SELECT MAX(DATE_TRUNC('week', scraped_at)::date) AS w FROM cleaned_listings
),
lifecycle AS (
  SELECT
    zpid,
    CASE WHEN beds IS NULL OR beds = 0 THEN 0 WHEN beds >= 3 THEN 3 ELSE beds END AS beds,
    MIN(DATE_TRUNC('week', scraped_at)::date) AS first_seen,
    MAX(DATE_TRUNC('week', scraped_at)::date) AS last_seen
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND p_reits_only = (building_zpid IS NOT NULL)
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
  COUNT(*) FILTER (WHERE l.first_seen = w.week_start)                                    AS new_listings,
  COUNT(*) FILTER (WHERE l.last_seen = w.week_start AND l.last_seen < (SELECT w FROM latest_week)) AS closed_listings,
  COUNT(*) FILTER (WHERE l.first_seen <= w.week_start AND l.last_seen >= w.week_start)   AS accumulated_listings
FROM all_weeks w
CROSS JOIN bed_types b
JOIN lifecycle l ON l.beds = b.beds
GROUP BY w.week_start, b.beds
ORDER BY w.week_start, b.beds;
$function$
