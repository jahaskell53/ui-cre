-- Fix sales-trends v2 RPCs: missing statement_timeout, work_mem, and zip index.
--
-- Four issues identified that cause intermittent timeouts on /analytics/sales-trends:
--
-- 1. get_crexi_sales_trends_v2 (ZIP path) was defined without SET statement_timeout,
--    so it inherits the PostgREST session default (~8s) and times out on cold cache.
--    All spatial v2 variants already have SET statement_timeout = '120s' from their
--    respective migrations, but the ZIP v2 was missed.
--
-- 2. None of the five v2 functions had SET work_mem = '64MB'. Without it, the three
--    PERCENTILE_CONT sorts (p25/median/p75) spill to disk at default work_mem (~2MB),
--    adding several seconds per call. The v1 equivalents got this in
--    20260502000000_crexi_sales_trends_workmem_partial_gist.sql.
--
-- 3. No index exists on crexi_api_comps(zip). Every ZIP-based call seq-scans
--    all ~286k rows to find the matching subset. A partial B-tree index on the
--    eligible rows cuts that to a fast bitmap index scan, matching the same WHERE
--    predicate used in get_crexi_sales_trends_v2.
--
-- (The fourth issue — Vercel /api/rpc function maxDuration — is fixed separately
--  via export const maxDuration in the route file.)

-- 1. statement_timeout on ZIP v2 (the only v2 variant that was missing it)
ALTER FUNCTION public.get_crexi_sales_trends_v2(text, integer, integer)
    SET statement_timeout = '120s';

-- 2. work_mem on all five v2 functions
ALTER FUNCTION public.get_crexi_sales_trends_v2(text, integer, integer)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_city_v2(text, text, integer, integer)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_county_v2(text, text, integer, integer)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood_v2(integer[], integer, integer)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa_v2(text, integer, integer)
    SET work_mem = '64MB';

-- 3. Partial B-tree index on zip for the ZIP-based sales-trends query.
--    Predicate matches the WHERE clause in get_crexi_sales_trends_v2 exactly,
--    so the planner will use this index for all ZIP lookups on eligible rows.
CREATE INDEX IF NOT EXISTS crexi_api_comps_sales_trends_zip_idx
    ON public.crexi_api_comps (zip)
    WHERE is_sales_comp = true
      AND NOT exclude_from_sales_trends
      AND property_price_total IS NOT NULL
      AND property_price_total > 0
      AND num_units IS NOT NULL
      AND num_units > 0
      AND sale_transaction_date IS NOT NULL
      AND zip IS NOT NULL;
