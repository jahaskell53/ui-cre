-- Raise statement_timeout and work_mem on Zillow market-activity RPCs.
--
-- get_rent_trends* and get_comps were raised to 120s in
-- 20260503110000_rent_trends_comps_timeout_workmem.sql; get_market_activity*
-- overloads were still at 30s from 20260410060000_remaining_rpcs_statement_timeout.sql.
-- Production integration tests (SF county fixture) hit 57014 on
-- get_market_activity_by_county at the 30s cap as cleaned_listings grew.

-- get_market_activity overloads
ALTER FUNCTION public.get_market_activity(text, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity(text, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_market_activity(text, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity(text, boolean, text)
    SET work_mem = '64MB';

-- get_market_activity_by_city overloads
ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean, text)
    SET work_mem = '64MB';

-- get_market_activity_by_neighborhood overloads
ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean, text)
    SET work_mem = '64MB';

-- get_market_activity_by_county overloads
ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean, text)
    SET work_mem = '64MB';

-- get_market_activity_by_msa overloads
ALTER FUNCTION public.get_market_activity_by_msa(text, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_msa(text, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_market_activity_by_msa(text, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_market_activity_by_msa(text, boolean, text)
    SET work_mem = '64MB';
