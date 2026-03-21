CREATE OR REPLACE FUNCTION public.get_map_rent_trends(p_beds integer, p_weeks_back integer DEFAULT 13, p_reits_only boolean DEFAULT false)
 RETURNS TABLE(zip text, geom_json text, current_median numeric, prior_median numeric, pct_change numeric, listing_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    WITH weekly AS (
        SELECT
            address_zip                                                    AS z,
            DATE_TRUNC('week', scraped_at)::date                           AS week_start,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)             AS median_rent,
            COUNT(DISTINCT zpid)                                           AS n
        FROM cleaned_listings
        WHERE price > 500
          AND price < 30000
          AND address_zip IS NOT NULL
          AND scraped_at >= NOW() - (p_weeks_back || ' weeks')::interval
          AND CASE WHEN COALESCE(beds, 0) >= 3 THEN 3 ELSE COALESCE(beds, 0) END = p_beds
          AND (
              (p_reits_only     AND building_zpid IS NOT NULL)
           OR (NOT p_reits_only AND building_zpid IS NULL)
          )
        GROUP BY address_zip, week_start
    ),
    ranked AS (
        SELECT
            z,
            median_rent,
            n,
            ROW_NUMBER() OVER (PARTITION BY z ORDER BY week_start DESC) AS rn_desc,
            ROW_NUMBER() OVER (PARTITION BY z ORDER BY week_start ASC)  AS rn_asc,
            COUNT(*)     OVER (PARTITION BY z)                          AS week_count,
            SUM(n)       OVER (PARTITION BY z)                          AS total_n
        FROM weekly
    ),
    current_vals AS (
        SELECT z, median_rent, total_n FROM ranked WHERE rn_desc = 1 AND week_count >= 2
    ),
    prior_vals AS (
        SELECT z, median_rent FROM ranked WHERE rn_asc = 1 AND week_count >= 2
    )
    SELECT
        c.z                                                                     AS zip,
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(zk.geom, 0.001))              AS geom_json,
        c.median_rent                                                           AS current_median,
        p.median_rent                                                           AS prior_median,
        CASE WHEN p.median_rent > 0
            THEN ROUND(((c.median_rent - p.median_rent) / p.median_rent * 100)::numeric, 1)
            ELSE NULL
        END                                                                     AS pct_change,
        c.total_n                                                               AS listing_count
    FROM current_vals  c
    JOIN prior_vals    p  ON c.z  = p.z
    JOIN zip_codes     zk ON c.z  = zk.zip
    WHERE zk.geom IS NOT NULL;
$function$
