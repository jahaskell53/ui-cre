-- Fix closed_listings always returning 0 (and new_listings always equaling
-- accumulated_listings) when the scraper has gaps between weeks.
--
-- Root cause (migration 016): both new_counts and closed_counts joined on exact
-- ±7-day offsets (cur.week_start - INTERVAL '7 days' and
-- prev.week_start + INTERVAL '7 days'). But the scraper doesn't run every 7 days.
-- When weeks are 14 or 21 days apart the joins never match, so:
--   - new_counts: every listing appears "new" each week (no match 7 days prior)
--   - closed_counts: closures are attributed to week_start+7d dates that don't
--     exist in all_weeks, so the final LEFT JOIN never matches → always 0.
--
-- Fix: use week_pairs (LEAD/LAG over all_weeks) to find the actual adjacent scrape
-- week instead of a fixed ±7 day offset.

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
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
-- Map each week to the immediately following scrape week (regardless of gap size).
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  -- A listing is "new" if it didn't appear in the immediately preceding scrape week.
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  -- A listing is closed if it appeared in prev_week but is absent from next_week.
  -- Attribute the closure to next_week so the velocity chart aligns with inventory.
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL  -- skip the last week (no following week yet)
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
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  -- A listing is "new" if it didn't appear in the immediately preceding scrape week.
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
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
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  -- A listing is "new" if it didn't appear in the immediately preceding scrape week.
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
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
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  -- A listing is "new" if it didn't appear in the immediately preceding scrape week.
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
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
all_weeks AS (
  SELECT DISTINCT week_start FROM weekly
),
bed_types AS (SELECT DISTINCT beds FROM weekly),
week_pairs AS (
  SELECT
    week_start AS prev_week,
    LEAD(week_start) OVER (ORDER BY week_start) AS next_week
  FROM all_weeks
),
new_counts AS (
  -- A listing is "new" if it didn't appear in the immediately preceding scrape week.
  SELECT cur.week_start, cur.beds, COUNT(*) AS cnt
  FROM weekly cur
  JOIN week_pairs wp ON wp.next_week = cur.week_start
  LEFT JOIN weekly prev
    ON prev.zpid = cur.zpid AND prev.beds = cur.beds
    AND prev.week_start = wp.prev_week
  WHERE prev.zpid IS NULL
  GROUP BY cur.week_start, cur.beds
),
closed_counts AS (
  SELECT wp.next_week AS week_start, prev.beds, COUNT(*) AS cnt
  FROM weekly prev
  JOIN week_pairs wp ON wp.prev_week = prev.week_start
  LEFT JOIN weekly nxt
    ON nxt.zpid = prev.zpid AND nxt.beds = prev.beds
    AND nxt.week_start = wp.next_week
  WHERE nxt.zpid IS NULL
    AND wp.next_week IS NOT NULL
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
