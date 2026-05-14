-- Crexi sales trends: exclude the prior calendar month (America/Los_Angeles).
--
-- Late-recorded deed / Crexi updates make the most recently completed month
-- unreliable in charts. This migration adds a shared helper and applies it to
-- every Crexi time-series, bucket-listing, and map choropleth RPC that reads
-- crexi_api_comps for sales comps (no silver-table deletes).

CREATE OR REPLACE FUNCTION public.crexi_sales_trends_reporting_lag_month(p_sale text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $f$
  SELECT to_char(p_sale::date, 'YYYY-MM') = to_char(
    ((current_timestamp AT TIME ZONE 'America/Los_Angeles')::date - interval '1 month'),
    'YYYY-MM'
  );
$f$;

COMMENT ON FUNCTION public.crexi_sales_trends_reporting_lag_month(text) IS
  'True when sale_transaction_date falls in the calendar month before the current America/Los_Angeles date; exclude from Crexi sales-trend aggregates.';


CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends(
  p_zip text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(sale_transaction_date)
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city(
  p_city text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(sale_transaction_date)
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND city ILIKE p_city
    AND state ILIKE p_state
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county(
  p_county_name text,
  p_state text
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '120s'
SET work_mem = '64MB'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Covers(cb.geom, c.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
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
SET work_mem = '64MB'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Covers(n.geom, c.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
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
SET work_mem = '64MB'
AS $function$
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Covers(mb.geom, c.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
    AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
    AND c.num_units IS NOT NULL AND c.num_units > 0
    AND c.sale_transaction_date IS NOT NULL
    AND c.geom IS NOT NULL
    AND mb.geoid = p_geoid
  GROUP BY 1
  ORDER BY 1;
$function$;


DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_v2(text, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_city_v2(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_county_v2(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_neighborhood_v2(integer[], integer, integer);
DROP FUNCTION IF EXISTS public.get_crexi_sales_trends_by_msa_v2(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_v2(
  p_zip        text    DEFAULT NULL,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
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
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(property_price_total / num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)
    )::numeric AS median_cap_rate,
    MIN(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent))::numeric AS min_cap_rate,
    MAX(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent))::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(sale_transaction_date)
    AND property_price_total IS NOT NULL AND property_price_total > 0
    AND num_units IS NOT NULL AND num_units > 0
    AND sale_transaction_date IS NOT NULL
    AND (p_zip IS NULL OR zip = p_zip)
    AND (p_min_units IS NULL OR num_units >= p_min_units)
    AND (p_max_units IS NULL OR num_units <= p_max_units)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_city_v2(
  p_city       text,
  p_state      text,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
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
  SELECT
    DATE_TRUNC('month', sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS median_price,
    AVG(property_price_total / num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY property_price_total / num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY COALESCE(sale_cap_rate_percent, financials_cap_rate_percent)
    )::numeric AS median_cap_rate,
    MIN(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent))::numeric AS min_cap_rate,
    MAX(COALESCE(sale_cap_rate_percent, financials_cap_rate_percent))::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps
  WHERE
    is_sales_comp = true
    AND NOT exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(sale_transaction_date)
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

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_county_v2(
  p_county_name text,
  p_state       text,
  p_min_units   integer DEFAULT NULL,
  p_max_units   integer DEFAULT NULL
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
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)
    )::numeric AS median_cap_rate,
    MIN(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent))::numeric AS min_cap_rate,
    MAX(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent))::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), cb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
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

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_neighborhood_v2(
  p_neighborhood_ids integer[],
  p_min_units        integer DEFAULT NULL,
  p_max_units        integer DEFAULT NULL
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
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)
    )::numeric AS median_cap_rate,
    MIN(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent))::numeric AS min_cap_rate,
    MAX(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent))::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), n.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
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

CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_by_msa_v2(
  p_geoid      text,
  p_min_units  integer DEFAULT NULL,
  p_max_units  integer DEFAULT NULL
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
  SELECT
    DATE_TRUNC('month', c.sale_transaction_date::date)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS median_price,
    AVG(c.property_price_total / c.num_units::numeric)::numeric AS avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p25_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)::numeric AS p75_price,
    AVG(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)) AS avg_cap_rate,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent)
    )::numeric AS median_cap_rate,
    MIN(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent))::numeric AS min_cap_rate,
    MAX(COALESCE(c.sale_cap_rate_percent, c.financials_cap_rate_percent))::numeric AS max_cap_rate,
    COUNT(*) AS listing_count
  FROM crexi_api_comps c
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326), mb.geom)
  WHERE
    c.is_sales_comp = true
    AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
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


CREATE OR REPLACE FUNCTION public.get_crexi_sales_trends_bucket_listings(
    p_area_kind        text,
    p_bucket_start     date,
    p_months_per_bucket integer DEFAULT 1,
    p_offset           integer  DEFAULT 0,
    p_limit            integer  DEFAULT 50,
    p_zip              text     DEFAULT NULL,
    p_city             text     DEFAULT NULL,
    p_state            text     DEFAULT NULL,
    p_county_name      text     DEFAULT NULL,
    p_geoid            text     DEFAULT NULL,
    p_neighborhood_ids integer[] DEFAULT NULL,
    p_min_units        integer  DEFAULT NULL,
    p_max_units        integer  DEFAULT NULL
)
RETURNS TABLE(
    id                         bigint,
    crexi_id                   text,
    property_name              text,
    address_full               text,
    city                       text,
    state                      text,
    zip                        text,
    property_price_total       double precision,
    num_units                  integer,
    price_per_door             double precision,
    sale_transaction_date      text,
    sale_cap_rate_percent      double precision,
    financials_cap_rate_percent double precision,
    total_count                bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET work_mem = '64MB'
SET statement_timeout = '120s'
AS $$
DECLARE
    v_window_start date := p_bucket_start;
    v_window_end   date := (p_bucket_start + (GREATEST(1, COALESCE(p_months_per_bucket, 1)) || ' months')::interval)::date;
    v_offset       int  := GREATEST(0, COALESCE(p_offset, 0));
    v_limit        int  := LEAST(200, GREATEST(1, COALESCE(p_limit, 50)));
BEGIN
    IF p_area_kind = 'zip' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM crexi_api_comps c
            WHERE
                c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND c.zip = p_zip
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'city' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM crexi_api_comps c
            WHERE
                c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND c.city  ILIKE p_city
                AND c.state ILIKE p_state
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'county' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM county_boundaries cb
            JOIN crexi_api_comps c
              ON c.geom IS NOT NULL
             AND ST_Covers(cb.geom, c.geom)
            WHERE
                cb.name_lsad ILIKE p_county_name
                AND cb.state = p_state
                AND c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'neighborhood' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM neighborhoods n
            JOIN crexi_api_comps c
              ON c.geom IS NOT NULL
             AND ST_Covers(n.geom, c.geom)
            WHERE
                n.id = ANY(p_neighborhood_ids)
                AND c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    ELSIF p_area_kind = 'msa' THEN
        RETURN QUERY
        WITH base AS (
            SELECT
                c.id,
                c.crexi_id,
                c.property_name,
                c.address_full,
                c.city,
                c.state,
                c.zip,
                c.property_price_total,
                c.num_units,
                (c.property_price_total / c.num_units::double precision) AS price_per_door,
                c.sale_transaction_date,
                c.sale_cap_rate_percent,
                c.financials_cap_rate_percent
            FROM msa_boundaries mb
            JOIN crexi_api_comps c
              ON c.geom IS NOT NULL
             AND ST_Covers(mb.geom, c.geom)
            WHERE
                mb.geoid = p_geoid
                AND c.is_sales_comp = true
                AND NOT c.exclude_from_sales_trends
                AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
                AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
                AND c.num_units IS NOT NULL AND c.num_units > 0
                AND c.sale_transaction_date IS NOT NULL
                AND c.sale_transaction_date::date >= v_window_start
                AND c.sale_transaction_date::date <  v_window_end
                AND (p_min_units IS NULL OR c.num_units >= p_min_units)
                AND (p_max_units IS NULL OR c.num_units <= p_max_units)
        )
        SELECT
            b.id, b.crexi_id, b.property_name, b.address_full,
            b.city, b.state, b.zip,
            b.property_price_total, b.num_units, b.price_per_door,
            b.sale_transaction_date, b.sale_cap_rate_percent,
            b.financials_cap_rate_percent,
            COUNT(*) OVER ()::bigint AS total_count
        FROM base b
        ORDER BY b.sale_transaction_date::date DESC, b.id DESC
        OFFSET v_offset LIMIT v_limit;

    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    zip            text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        LEFT(c.zip, 5)                                                             AS z,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.zip IS NOT NULL AND LENGTH(c.zip) >= 5
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY LEFT(c.zip, 5)
)
SELECT
    c.z                                                                            AS zip,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN zip_codes zk ON c.z = zk.zip
WHERE zk.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_neighborhood(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    neighborhood_id integer,
    name           text,
    city           text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        n.id                                                                       AS nh_id,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN neighborhoods n ON ST_Within(c.geom, n.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY n.id
)
SELECT
    n.id                                                                           AS neighborhood_id,
    n.name::text,
    n.city::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN neighborhoods n ON c.nh_id = n.id
WHERE n.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_city(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    city_name      text,
    state          text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        cb.name                                                                    AS city_name,
        cb.state,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN city_boundaries cb
        ON lower(c.city)  = lower(cb.name)
        AND lower(c.state) = lower(cb.state)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.city IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY cb.name, cb.state
)
SELECT
    c.city_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))                    AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_county(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    county_name    text,
    state          text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        cb.name_lsad                                                               AS county_name,
        cb.state,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN county_boundaries cb ON ST_Within(c.geom, cb.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY cb.name_lsad, cb.state
)
SELECT
    c.county_name,
    c.state,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN county_boundaries cb ON cb.name_lsad = c.county_name AND cb.state = c.state
WHERE cb.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_map_crexi_sales_trends_by_msa(
    p_months_back integer DEFAULT 12
)
RETURNS TABLE(
    geoid          text,
    name           text,
    geom_json      text,
    current_median numeric,
    prior_median   numeric,
    pct_change     numeric,
    listing_count  bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
WITH bounds AS (
    SELECT
        (NOW()::date - (p_months_back || ' months')::interval)::date AS window_start,
        (NOW()::date - (p_months_back / 2 || ' months')::interval)::date AS midpoint
),
combined AS (
    SELECT
        mb.geoid,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)             AS prior_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date <  b.midpoint)        AS prior_cnt,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.property_price_total / c.num_units::numeric)
            FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)             AS current_median,
        COUNT(*) FILTER (WHERE c.sale_transaction_date::date >= b.midpoint)        AS current_cnt,
        COUNT(*)                                                                    AS total_n
    FROM crexi_api_comps c
    JOIN msa_boundaries mb ON ST_Within(c.geom, mb.geom)
    CROSS JOIN bounds b
    WHERE c.is_sales_comp = true
      AND NOT c.exclude_from_sales_trends
    AND NOT public.crexi_sales_trends_reporting_lag_month(c.sale_transaction_date)
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND c.geom IS NOT NULL
      AND c.sale_transaction_date::date >= b.window_start
    GROUP BY mb.geoid
)
SELECT
    mb.geoid,
    mb.name::text,
    ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))                     AS geom_json,
    c.current_median,
    c.prior_median,
    CASE WHEN c.prior_cnt >= 2 AND c.current_cnt >= 2 AND c.prior_median > 0
        THEN ROUND(((c.current_median - c.prior_median) / c.prior_median * 100)::numeric, 1)
        ELSE NULL
    END                                                                            AS pct_change,
    c.total_n                                                                      AS listing_count
FROM combined c
JOIN msa_boundaries mb ON c.geoid = mb.geoid
WHERE mb.geom IS NOT NULL
  AND c.prior_cnt >= 2
  AND c.current_cnt >= 2;
$function$;
