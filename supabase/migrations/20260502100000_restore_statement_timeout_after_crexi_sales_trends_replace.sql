-- Re-apply statement_timeout on heavy spatial RPCs after CREATE OR REPLACE dropped it.
--
-- Migration 20260430200000_crexi_sales_trends_exclude_split_duplicates.sql replaced
-- get_crexi_sales_trends_by_* with CREATE OR REPLACE ... AS $function$ ... $function$
-- without SET statement_timeout. In PostgreSQL, that resets function-level options
-- previously set by ALTER FUNCTION (see 20260430000000_crexi_sales_trends_timeout_120s.sql),
-- so these RPCs fell back to the session default and returned 57014 in CI.
--
-- get_market_activity_by_msa (SF Bay Area) can exceed 30s under load; align with
-- the Crexi spatial RPC budget.

ALTER FUNCTION public.get_crexi_sales_trends_by_city(text, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_crexi_sales_trends_by_county(text, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_crexi_sales_trends_by_neighborhood(integer[])
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_crexi_sales_trends_by_msa(text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_msa(text, boolean)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_msa(text, boolean, text)
    SET statement_timeout = '120s';
