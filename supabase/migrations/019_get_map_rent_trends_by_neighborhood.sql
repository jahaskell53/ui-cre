CREATE OR REPLACE FUNCTION public.get_map_rent_trends_by_neighborhood(
    p_beds        integer,
    p_weeks_back  integer DEFAULT 13,
    p_reits_only  boolean DEFAULT false
)
RETURNS TABLE (
    neighborhood_id  integer,
    name             text,
    city             text,
    geom_json        text,
    current_median   numeric,
    prior_median     numeric,
    pct_change       numeric,
    listing_count    bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH weekly AS (
        SELECT
            n.id                                                               AS nh_id,
            DATE_TRUNC('week', cl.scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cl.price)             AS median_rent,
            COUNT(DISTINCT cl.zpid)                                           AS cnt
        FROM cleaned_listings cl
        JOIN neighborhoods n ON ST_Within(cl.geom, n.geom)
        WHERE cl.price > 500
          AND cl.price < 30000
          AND cl.geom IS NOT NULL
          AND cl.scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(cl.beds, 0) >= 3 THEN 3 ELSE COALESCE(cl.beds, 0) END = p_beds
          AND (
              (p_reits_only     AND cl.building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND cl.building_zpid IS NULL)
          )
        GROUP BY n.id, week_start
    ),
    ranked AS (
        SELECT
            nh_id,
            median_rent,
            cnt,
            ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY nh_id ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY nh_id)                          AS week_count,
            SUM(cnt)     OVER (PARTITION BY nh_id)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT nh_id, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT nh_id, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        n.id                                                                    AS neighborhood_id,
        n.name::text,
        n.city::text,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(n.geom, 0.0005))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.nh_id = p.nh_id
    JOIN neighborhoods n  ON c.nh_id = n.id
    WHERE n.geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_rent_trends_by_neighborhood(integer, integer, boolean) TO anon, authenticated;
