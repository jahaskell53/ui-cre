-- Sales trends RPC functions using loopnet_listings.
-- Bucketed by month (commercial listings are sparse compared to weekly rental scrapes).
-- Returns: month_start, median_price, avg_cap_rate, listing_count
-- p_property_type: NULL = all categories, otherwise filters by building_category (ILIKE).

CREATE OR REPLACE FUNCTION public.get_sales_trends(
  p_zip text DEFAULT NULL,
  p_property_type text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings
  WHERE
    price_numeric IS NOT NULL AND price_numeric > 0
    AND (p_zip IS NULL OR zip = p_zip)
    AND (p_property_type IS NULL OR building_category ILIKE p_property_type)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_city(
  p_city text,
  p_state text,
  p_property_type text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings
  WHERE
    price_numeric IS NOT NULL AND price_numeric > 0
    AND city ILIKE p_city
    AND state ILIKE p_state
    AND (p_property_type IS NULL OR building_category ILIKE p_property_type)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_county(
  p_county_name text,
  p_state text,
  p_property_type text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', ll.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ll.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(ll.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings ll
  JOIN county_boundaries cb
    ON ST_Within(ST_SetSRID(ST_Point(ll.longitude, ll.latitude), 4326), cb.geom)
  WHERE
    ll.price_numeric IS NOT NULL AND ll.price_numeric > 0
    AND ll.latitude IS NOT NULL AND ll.longitude IS NOT NULL
    AND cb.name ILIKE p_county_name
    AND cb.state = p_state
    AND (p_property_type IS NULL OR ll.building_category ILIKE p_property_type)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_msa(
  p_geoid text,
  p_property_type text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', ll.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ll.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(ll.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings ll
  JOIN msa_boundaries mb
    ON ST_Within(ST_SetSRID(ST_Point(ll.longitude, ll.latitude), 4326), mb.geom)
  WHERE
    ll.price_numeric IS NOT NULL AND ll.price_numeric > 0
    AND ll.latitude IS NOT NULL AND ll.longitude IS NOT NULL
    AND mb.geoid = p_geoid
    AND (p_property_type IS NULL OR ll.building_category ILIKE p_property_type)
  GROUP BY 1
  ORDER BY 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_trends_by_neighborhood(
  p_neighborhood_ids integer[],
  p_property_type text DEFAULT NULL
)
RETURNS TABLE(month_start date, median_price numeric, avg_cap_rate numeric, listing_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    DATE_TRUNC('month', ll.scraped_at)::date AS month_start,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ll.price_numeric)::numeric AS median_price,
    AVG((REGEXP_MATCH(ll.cap_rate, '([0-9]+\.?[0-9]*)'))[1]::numeric) AS avg_cap_rate,
    COUNT(*) AS listing_count
  FROM loopnet_listings ll
  JOIN neighborhoods n
    ON ST_Within(ST_SetSRID(ST_Point(ll.longitude, ll.latitude), 4326), n.geom)
  WHERE
    ll.price_numeric IS NOT NULL AND ll.price_numeric > 0
    AND ll.latitude IS NOT NULL AND ll.longitude IS NOT NULL
    AND n.id = ANY(p_neighborhood_ids)
    AND (p_property_type IS NULL OR ll.building_category ILIKE p_property_type)
  GROUP BY 1
  ORDER BY 1;
$function$;
