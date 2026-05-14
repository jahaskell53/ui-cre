-- Exclude every Crexi row in a detected split-portfolio group from sales trends,
-- including the historical MIN(id) keeper row.
--
-- Background: 20260430200000_crexi_sales_trends_exclude_split_duplicates.sql merged
-- SUM(num_units) onto the keeper and soft-excluded only non-keeper parcel lines.
-- Product decision: price-per-door on these large split-book deals is unreliable,
-- so drop the whole group from sales-trend aggregates instead of keeping one row.
--
-- Detection matches the original migration: county via ST_Within, county-year with
-- at least 30 comps, same (county, year, sale date, price, seller, buyer) group
-- with COUNT(*) > 1, and MAX(price/door) above the Tukey upper fence.

SET statement_timeout = 0;

WITH located AS (
    SELECT DISTINCT ON (c.id)
        c.id,
        EXTRACT(YEAR FROM c.sale_transaction_date::date)::integer AS sale_yr,
        c.sale_transaction_date::date AS sale_dt,
        c.property_price_total AS price,
        c.sale_seller,
        c.sale_buyer,
        c.num_units,
        c.property_price_total / c.num_units::numeric AS ppd,
        cb.name_lsad AS county_lsad,
        cb.state AS county_state
    FROM public.crexi_api_comps c
    JOIN public.county_boundaries cb
        ON ST_Within(
            COALESCE(c.geom, ST_SetSRID(ST_Point(c.longitude, c.latitude), 4326)),
            cb.geom
        )
    WHERE c.is_sales_comp = true
      AND c.property_price_total IS NOT NULL AND c.property_price_total > 0
      AND c.num_units IS NOT NULL AND c.num_units > 0
      AND c.sale_transaction_date IS NOT NULL
      AND (
          c.geom IS NOT NULL
          OR (c.longitude IS NOT NULL AND c.latitude IS NOT NULL)
      )
    ORDER BY c.id, cb.name_lsad
),
fence AS (
    SELECT
        county_lsad,
        county_state,
        sale_yr,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ppd) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ppd) AS q3
    FROM located
    GROUP BY county_lsad, county_state, sale_yr
    HAVING COUNT(*) >= 30
),
fence2 AS (
    SELECT
        county_lsad,
        county_state,
        sale_yr,
        q3 + 1.5 * (q3 - q1) AS upper_fence
    FROM fence
),
grp AS (
    SELECT
        l.*,
        COUNT(*) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS gsize,
        MAX(ppd) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS gmax_ppd,
        MIN(id) OVER (
            PARTITION BY county_lsad, county_state, sale_yr, sale_dt, price, sale_seller, sale_buyer
        ) AS keeper_id
    FROM located l
),
split_portfolio_members AS (
    SELECT g.id
    FROM grp g
    JOIN fence2 f
        ON f.county_lsad = g.county_lsad
        AND f.county_state = g.county_state
        AND f.sale_yr = g.sale_yr
    WHERE g.gsize > 1
      AND g.gmax_ppd > f.upper_fence
)
UPDATE public.crexi_api_comps c
SET exclude_from_sales_trends = true,
    sales_trends_exclusion_reason = coalesce(c.sales_trends_exclusion_reason, 'crexi_split_portfolio_group')
FROM split_portfolio_members m
WHERE c.id = m.id;
