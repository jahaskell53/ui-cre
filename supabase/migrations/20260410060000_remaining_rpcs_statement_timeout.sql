-- Set function-level statement_timeout on all remaining slow RPCs.
--
-- get_comps runs ~8.4s on a warm cache (over the 8s authenticator limit).
-- get_rent_trends and get_market_activity* are similarly expensive under load.
-- All overloads of each function must be covered individually since
-- ALTER FUNCTION matches on exact argument signatures.
--
-- get_rent_trends overloads
ALTER FUNCTION public.get_rent_trends(text, integer)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_rent_trends(text, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_rent_trends(text, integer, boolean, text)
    SET statement_timeout TO '30s';

-- get_rent_trends_by_neighborhood overloads
ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean, text)
    SET statement_timeout TO '30s';

-- get_rent_trends_by_city overloads
ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean, text)
    SET statement_timeout TO '30s';

-- get_rent_trends_by_county overloads
ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean, text)
    SET statement_timeout TO '30s';

-- get_rent_trends_by_msa overloads
ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean, text)
    SET statement_timeout TO '30s';

-- get_comps
ALTER FUNCTION public.get_comps(double precision, double precision, double precision, integer, integer, numeric, integer, integer, text, integer, text, boolean, integer[], text)
    SET statement_timeout TO '30s';

-- get_market_activity overloads
ALTER FUNCTION public.get_market_activity(text, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_market_activity(text, boolean, text)
    SET statement_timeout TO '30s';

-- get_market_activity_by_city overloads
ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_market_activity_by_city(text, text, boolean, text)
    SET statement_timeout TO '30s';

-- get_market_activity_by_neighborhood overloads
ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_market_activity_by_neighborhood(integer[], boolean, text)
    SET statement_timeout TO '30s';

-- get_market_activity_by_county overloads
ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_market_activity_by_county(text, text, boolean, text)
    SET statement_timeout TO '30s';

-- get_market_activity_by_msa overloads
ALTER FUNCTION public.get_market_activity_by_msa(text, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_market_activity_by_msa(text, boolean, text)
    SET statement_timeout TO '30s';
