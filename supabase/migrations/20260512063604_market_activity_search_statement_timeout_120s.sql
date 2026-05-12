-- Integration tests on main hit 57014 (statement_timeout) for Zillow market-activity
-- RPCs and for search_neighborhoods('Park') against a larger cleaned_listings /
-- neighborhoods dataset. get_market_activity_by_msa was already lifted to 120s in
-- 20260501150000_restore_sales_trends_statement_timeout.sql; align the other
-- get_market_activity* overloads and the proximity search helpers with the same
-- budget used for heavy spatial RPCs (see vitest.integration.config.ts).

ALTER FUNCTION public.get_market_activity(text, boolean)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity(text, boolean, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_msa(text, boolean)
    SET statement_timeout = '120s';

ALTER FUNCTION public.get_market_activity_by_msa(text, boolean, text)
    SET statement_timeout = '120s';

ALTER FUNCTION public.search_neighborhoods(text, double precision, double precision)
    SET statement_timeout = '120s';

ALTER FUNCTION public.search_msas(text, double precision, double precision)
    SET statement_timeout = '120s';
