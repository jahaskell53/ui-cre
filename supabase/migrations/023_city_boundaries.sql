-- City boundary data loaded from:
-- US Census Bureau TIGER/Line Shapefiles 2025, Places layer
-- https://www.census.gov/cgi-bin/geo/shapefiles/index.php?year=2025&layergroup=Places
-- File: tl_2025_06_place.zip (California places — incorporated cities, towns, and CDPs)
-- Loaded via load_city_boundaries.py: converted to GeoJSON (ogr2ogr, reprojected NAD83→WGS84),
-- inserted via psycopg2 in batches of 100, geom column populated with ST_Multi(ST_GeomFromGeoJSON(...)).
-- 1,619 features: 462 cities (LSAD 25), 21 towns (LSAD 43), 1,136 CDPs (LSAD 57).

CREATE TABLE IF NOT EXISTS public.city_boundaries (
  id         bigserial PRIMARY KEY,
  geoid      text UNIQUE NOT NULL,
  name       text NOT NULL,
  name_lsad  text,
  state_fips text,
  state      text,
  lsad       text,
  geom       geometry(MultiPolygon, 4326)
);

CREATE INDEX IF NOT EXISTS idx_city_boundaries_geom  ON public.city_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_city_boundaries_state ON public.city_boundaries (state);
CREATE INDEX IF NOT EXISTS idx_city_boundaries_name  ON public.city_boundaries (name, state);


CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_city(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    city_name       text,
    state           text,
    geom_json       text,
    current_median  numeric,
    prior_median    numeric,
    pct_change      numeric,
    listing_count   bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            cb.name                                                            AS city_name,
            cb.state                                                           AS state,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                            AS cnt
        FROM city_boundaries cb
        JOIN cleaned_listings cl
            ON lower(cl.address_city)  = lower(cb.name)
            AND lower(cl.address_state) = lower(cb.state)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY cb.name, cb.state, week_start
    ),
    ranked AS (
        SELECT
            city_name,
            state,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY city_name, state ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY city_name, state)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY city_name, state)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT city_name, state, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT city_name, state, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.city_name,
        c.state,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.0001))             AS geom_json,
        c.median_rent                                                            AS current_median,
        p.median_rent                                                            AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                      AS pct_change,
        c.total_n                                                                AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.city_name = p.city_name AND c.state = p.state
    JOIN city_boundaries cb ON cb.name = c.city_name AND cb.state = c.state
    WHERE cb.geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_city(integer, integer, boolean) TO anon, authenticated;
