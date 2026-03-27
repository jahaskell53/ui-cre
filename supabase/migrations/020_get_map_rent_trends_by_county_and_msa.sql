CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_county(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    county_name   text,
    state         text,
    geom_json     text,
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
            cb.name                                                            AS county_name,
            cb.state                                                           AS state,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN county_boundaries cb ON ST_Within(cl.geom, cb.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
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
            county_name,
            state,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY county_name, state ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY county_name, state)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY county_name, state)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT county_name, state, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT county_name, state, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.county_name,
        c.state,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(cb.geom, 0.001))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.county_name = p.county_name AND c.state = p.state
    JOIN county_boundaries cb ON cb.name = c.county_name AND cb.state = c.state
    WHERE cb.geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_county(integer, integer, boolean) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_msa(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    geoid           text,
    name            text,
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
            mb.geoid                                                           AS geoid,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN msa_boundaries mb ON ST_Within(cl.geom, mb.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY mb.geoid, week_start
    ),
    ranked AS (
        SELECT
            geoid,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY geoid ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY geoid)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY geoid)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT geoid, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT geoid, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        mb.geoid,
        mb.name::text,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(mb.geom, 0.005))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.geoid = p.geoid
    JOIN msa_boundaries mb ON c.geoid = mb.geoid
    WHERE mb.geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_msa(integer, integer, boolean) TO anon, authenticated;
