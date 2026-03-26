-- Rewrite all get_market_activity* functions to use raw scrape counts instead of
-- lifecycle inference. Since we assume a listing is active if it appears in a scrape,
-- accumulated_listings is a direct count of distinct zpids scraped that week.
-- new_listings = zpids present this week but not last week.
-- closed_listings = zpids present last week but absent this week (attributed to the
-- week they disappeared, so velocity and inventory charts align with no lag).

CREATE OR REPLACE FUNCTION public.get_market_activity(
  p_zip text DEFAULT NULL::text,
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  accumulated_listings bigint,
  closed_listings bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND (p_zip IS NULL OR address_zip = p_zip)
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
),
bounds AS (
  SELECT MIN(week_start) AS min_week, MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_neighborhood(
  p_neighborhood_ids integer[],
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  accumulated_listings bigint,
  closed_listings bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds
  FROM cleaned_listings cl
  JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
  WHERE
    cl.geom IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
),
bounds AS (
  SELECT MIN(week_start) AS min_week, MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_city(
  p_city text,
  p_state text,
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  accumulated_listings bigint,
  closed_listings bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', scraped_at)::date AS week_start,
    zpid,
    CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END AS beds
  FROM cleaned_listings
  WHERE
    zpid IS NOT NULL
    AND price > 500 AND price < 30000
    AND address_city ILIKE p_city
    AND address_state ILIKE p_state
    AND ((NOT p_reits_only AND building_zpid IS NULL) OR (p_reits_only AND building_zpid IS NOT NULL))
),
bounds AS (
  SELECT MIN(week_start) AS min_week, MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_county(
  p_county_name text,
  p_state text,
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  accumulated_listings bigint,
  closed_listings bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds
  FROM cleaned_listings cl
  JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND cb.name_lsad ILIKE p_county_name
    AND cb.state = p_state
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
),
bounds AS (
  SELECT MIN(week_start) AS min_week, MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$function$;

CREATE OR REPLACE FUNCTION public.get_market_activity_by_msa(
  p_geoid text,
  p_reits_only boolean DEFAULT false
)
RETURNS TABLE(
  week_start date,
  beds integer,
  new_listings bigint,
  accumulated_listings bigint,
  closed_listings bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
WITH weekly AS (
  SELECT DISTINCT
    DATE_TRUNC('week', cl.scraped_at)::date AS week_start,
    cl.zpid,
    CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END AS beds
  FROM cleaned_listings cl
  JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
  WHERE
    cl.geom IS NOT NULL
    AND mb.geoid = p_geoid
    AND cl.zpid IS NOT NULL
    AND cl.price > 500 AND cl.price < 30000
    AND ((NOT p_reits_only AND cl.building_zpid IS NULL) OR (p_reits_only AND cl.building_zpid IS NOT NULL))
),
bounds AS (
  SELECT MIN(week_start) AS min_week, MAX(week_start) AS max_week FROM weekly
),
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
new_counts AS (
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = cur.week_start - INTERVAL '7 days'
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT (prev.week_start + INTERVAL '7 days')::date AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = prev.week_start + INTERVAL '7 days'
  CROSS JOIN bounds
  WHERE nxt.zpid IS NULL
    AND (prev.week_start + INTERVAL '7 days')::date <= bounds.max_week
  GROUP BY 1, prev.beds
)
SELECT
  w.week_start,
  b.beds,
  COALESCE(n.cnt, 0) AS new_listings,
  COUNT(DISTINCT wl.zpid) AS accumulated_listings,
  COALESCE(c.cnt, 0) AS closed_listings
FROM all_weeks w
CROSS JOIN bed_types b
LEFT JOIN weekly wl ON wl.week_start = w.week_start AND wl.beds = b.beds
LEFT JOIN new_counts n ON n.week_start = w.week_start AND n.beds = b.beds
LEFT JOIN closed_counts c ON c.week_start = w.week_start AND c.beds = b.beds
GROUP BY w.week_start, b.beds, n.cnt, c.cnt
ORDER BY w.week_start, b.beds;
$function$;

GRANT EXECUTE ON FUNCTION public.get_market_activity(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_city(text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_county(text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_market_activity_by_msa(text, boolean) TO anon, authenticated;
