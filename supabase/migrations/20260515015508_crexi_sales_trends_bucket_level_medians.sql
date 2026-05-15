-- Compute Crexi sales-trends v2 sample windows at the listing level.
--
-- The frontend previously merged 3M/6M/1Y windows by taking the median of
-- monthly medians.  Add a defaulted bucket-size parameter so the RPCs can group
-- raw eligible comps into the selected calendar-aligned bucket and compute
-- PERCENTILE_CONT over the listing-level price-per-door values.

DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_v2(text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_city_v2(text, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_county_v2(text, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_neighborhood_v2(integer[], integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_msa_v2(text, integer, integer, integer);

DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_v2(text, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_city_v2(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_county_v2(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_neighborhood_v2(integer[], integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_msa_v2(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_v2(
  p_zip                 text    DEFAULT NULL,
  p_min_units           integer DEFAULT NULL,
  p_max_units           integer DEFAULT NULL,
  p_months_per_bucket   integer DEFAULT 1
)
RETURNS TABLE(
  month_start      date,
  median_price     numeric,
  avg_price        numeric,
  p25_price        numeric,
  p75_price        numeric,
  avg_cap_rate     numeric,
  median_cap_rate  numeric,
  min_cap_rate     numeric,
  max_cap_rate     numeric,
  listing_count    bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  WITH params AS (
    SELECT GREATEST(1, COALESCE(p_months_per_bucket, 1))::integer AS window_size
  ),
  base AS (
    SELECT
      c.sale_transaction_date::date AS sale_date,
      (c.property_price_total / c.num_units::numeric) AS price_per_door,
      COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent) AS cap_rate
    FROM crexi_api_comps c
    WHERE
      c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND (p_zip IS NULL OR c.zip = p_zip)
      AND (p_min_units IS NULL OR c.num_units >= p_min_units)
      AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  ),
  bucketed AS (
    SELECT
      make_date(
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) / 12)::integer,
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) % 12 + 1)::integer,
        1
      ) AS month_start,
      b.price_per_door,
      b.cap_rate
    FROM base b
    CROSS JOIN params p
  )
  SELECT
    b.month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS median_price,
    AVG(b.price_per_door)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p75_price,
    AVG(b.cap_rate) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.cap_rate)::numeric AS median_cap_rate,
    MIN(b.cap_rate)::numeric AS min_cap_rate,
    MAX(b.cap_rate)::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM bucketed b
  GROUP BY b.month_start
  ORDER BY b.month_start;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city_v2(
  p_city                text,
  p_state               text,
  p_min_units           integer DEFAULT NULL,
  p_max_units           integer DEFAULT NULL,
  p_months_per_bucket   integer DEFAULT 1
)
RETURNS TABLE(
  month_start      date,
  median_price     numeric,
  avg_price        numeric,
  p25_price        numeric,
  p75_price        numeric,
  avg_cap_rate     numeric,
  median_cap_rate  numeric,
  min_cap_rate     numeric,
  max_cap_rate     numeric,
  listing_count    bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  WITH params AS (
    SELECT GREATEST(1, COALESCE(p_months_per_bucket, 1))::integer AS window_size
  ),
  base AS (
    SELECT
      c.sale_transaction_date::date AS sale_date,
      (c.property_price_total / c.num_units::numeric) AS price_per_door,
      COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent) AS cap_rate
    FROM crexi_api_comps c
    WHERE
      c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.city ILIKE p_city
      AND c.state ILIKE p_state
      AND (p_min_units IS NULL OR c.num_units >= p_min_units)
      AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  ),
  bucketed AS (
    SELECT
      make_date(
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) / 12)::integer,
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) % 12 + 1)::integer,
        1
      ) AS month_start,
      b.price_per_door,
      b.cap_rate
    FROM base b
    CROSS JOIN params p
  )
  SELECT
    b.month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS median_price,
    AVG(b.price_per_door)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p75_price,
    AVG(b.cap_rate) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.cap_rate)::numeric AS median_cap_rate,
    MIN(b.cap_rate)::numeric AS min_cap_rate,
    MAX(b.cap_rate)::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM bucketed b
  GROUP BY b.month_start
  ORDER BY b.month_start;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county_v2(
  p_county_name         text,
  p_state               text,
  p_min_units           integer DEFAULT NULL,
  p_max_units           integer DEFAULT NULL,
  p_months_per_bucket   integer DEFAULT 1
)
RETURNS TABLE(
  month_start      date,
  median_price     numeric,
  avg_price        numeric,
  p25_price        numeric,
  p75_price        numeric,
  avg_cap_rate     numeric,
  median_cap_rate  numeric,
  min_cap_rate     numeric,
  max_cap_rate     numeric,
  listing_count    bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  WITH params AS (
    SELECT GREATEST(1, COALESCE(p_months_per_bucket, 1))::integer AS window_size
  ),
  base AS (
    SELECT
      c.sale_transaction_date::date AS sale_date,
      (c.property_price_total / c.num_units::numeric) AS price_per_door,
      COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent) AS cap_rate
    FROM crexi_api_comps c
    JOIN county_boundaries cb
      ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
    WHERE
      c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND cb.name_lsad ILIKE p_county_name
      AND cb.state = p_state
      AND (p_min_units IS NULL OR c.num_units >= p_min_units)
      AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  ),
  bucketed AS (
    SELECT
      make_date(
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) / 12)::integer,
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) % 12 + 1)::integer,
        1
      ) AS month_start,
      b.price_per_door,
      b.cap_rate
    FROM base b
    CROSS JOIN params p
  )
  SELECT
    b.month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS median_price,
    AVG(b.price_per_door)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p75_price,
    AVG(b.cap_rate) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.cap_rate)::numeric AS median_cap_rate,
    MIN(b.cap_rate)::numeric AS min_cap_rate,
    MAX(b.cap_rate)::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM bucketed b
  GROUP BY b.month_start
  ORDER BY b.month_start;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_neighborhood_v2(
  p_neighborhood_ids    integer[],
  p_min_units           integer DEFAULT NULL,
  p_max_units           integer DEFAULT NULL,
  p_months_per_bucket   integer DEFAULT 1
)
RETURNS TABLE(
  month_start      date,
  median_price     numeric,
  avg_price        numeric,
  p25_price        numeric,
  p75_price        numeric,
  avg_cap_rate     numeric,
  median_cap_rate  numeric,
  min_cap_rate     numeric,
  max_cap_rate     numeric,
  listing_count    bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  WITH params AS (
    SELECT GREATEST(1, COALESCE(p_months_per_bucket, 1))::integer AS window_size
  ),
  base AS (
    SELECT
      c.sale_transaction_date::date AS sale_date,
      (c.property_price_total / c.num_units::numeric) AS price_per_door,
      COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent) AS cap_rate
    FROM crexi_api_comps c
    JOIN neighborhoods n
      ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
    WHERE
      c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND n.id = ANY(p_neighborhood_ids)
      AND (p_min_units IS NULL OR c.num_units >= p_min_units)
      AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  ),
  bucketed AS (
    SELECT
      make_date(
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) / 12)::integer,
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) % 12 + 1)::integer,
        1
      ) AS month_start,
      b.price_per_door,
      b.cap_rate
    FROM base b
    CROSS JOIN params p
  )
  SELECT
    b.month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS median_price,
    AVG(b.price_per_door)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p75_price,
    AVG(b.cap_rate) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.cap_rate)::numeric AS median_cap_rate,
    MIN(b.cap_rate)::numeric AS min_cap_rate,
    MAX(b.cap_rate)::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM bucketed b
  GROUP BY b.month_start
  ORDER BY b.month_start;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa_v2(
  p_geoid               text,
  p_min_units           integer DEFAULT NULL,
  p_max_units           integer DEFAULT NULL,
  p_months_per_bucket   integer DEFAULT 1
)
RETURNS TABLE(
  month_start      date,
  median_price     numeric,
  avg_price        numeric,
  p25_price        numeric,
  p75_price        numeric,
  avg_cap_rate     numeric,
  median_cap_rate  numeric,
  min_cap_rate     numeric,
  max_cap_rate     numeric,
  listing_count    bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  WITH params AS (
    SELECT GREATEST(1, COALESCE(p_months_per_bucket, 1))::integer AS window_size
  ),
  base AS (
    SELECT
      c.sale_transaction_date::date AS sale_date,
      (c.property_price_total / c.num_units::numeric) AS price_per_door,
      COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent) AS cap_rate
    FROM crexi_api_comps c
    JOIN msa_boundaries mb
      ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
    WHERE
      c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND mb.geoid = p_geoid
      AND (p_min_units IS NULL OR c.num_units >= p_min_units)
      AND (p_max_units IS NULL OR c.num_units <= p_max_units)
  ),
  bucketed AS (
    SELECT
      make_date(
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) / 12)::integer,
        ((((EXTRACT(YEAR FROM b.sale_date)::integer * 12 + EXTRACT(MONTH FROM b.sale_date)::integer - 1) / p.window_size) * p.window_size) % 12 + 1)::integer,
        1
      ) AS month_start,
      b.price_per_door,
      b.cap_rate
    FROM base b
    CROSS JOIN params p
  )
  SELECT
    b.month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS median_price,
    AVG(b.price_per_door)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.price_per_door)::numeric AS p75_price,
    AVG(b.cap_rate) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.cap_rate)::numeric AS median_cap_rate,
    MIN(b.cap_rate)::numeric AS min_cap_rate,
    MAX(b.cap_rate)::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM bucketed b
  GROUP BY b.month_start
  ORDER BY b.month_start;
$function$;
