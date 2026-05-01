-- Re-apply statement_timeout on heavy spatial RPCs after CREATE OR REPLACE
-- silently dropped the function-level option installed via ALTER FUNCTION.
--
-- Migration 20260430200000_crexi_sales_trends_exclude_split_duplicates.sql used
-- CREATE OR REPLACE FUNCTION on the v1 Crexi sales-trends RPCs (by_city, by_county,
-- by_neighborhood, by_msa, get_crexi_sales_trends) without a SET statement_timeout
-- clause. In PostgreSQL, replacing a function without SET options resets any
-- function-level GUCs previously applied via ALTER FUNCTION (see migration
-- 20260430000000_crexi_sales_trends_timeout_120s.sql), so the RPCs reverted to
-- the PostgREST session default and started returning 57014 in CI for the SF
-- Bay Area test fixtures. Restore the 120s budget here.
--
-- get_market_activity_by_msa (SF Bay Area) hits the same scale ceiling against
-- the post-OPE-219 dataset; lift it from 30s to 120s for parity.

ALTER FUNCTION public.get_crexi_sales_trends(text)
    SET statement_timeout = '120s';

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
