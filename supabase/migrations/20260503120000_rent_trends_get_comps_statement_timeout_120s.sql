-- Raise statement_timeout on rent-trends and get_comps RPCs from 30s to 120s.
--
-- CI integration tests call these against production-scale data; PostgreSQL was
-- returning 57014 (query_canceled / statement timeout) while Vitest already
-- allows 120s (vitest.integration.config.ts). Align DB budgets with other heavy
-- spatial RPCs (e.g. Crexi sales trends at 120s).
--
-- Each overload must be altered with its exact argument signature.

-- get_rent_trends overloads
ALTER FUNCTION public.get_rent_trends(text, integer)
    SET statement_timeout TO '120s';

ALTER FUNCTION public.get_rent_trends(text, integer, boolean)
    SET statement_timeout TO '120s';

ALTER FUNCTION public.get_rent_trends(text, integer, boolean, text)
    SET statement_timeout TO '120s';

-- get_rent_trends_by_neighborhood overloads
ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean)
    SET statement_timeout TO '120s';

ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean, text)
    SET statement_timeout TO '120s';

-- get_rent_trends_by_city overloads
ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean)
    SET statement_timeout TO '120s';

ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean, text)
    SET statement_timeout TO '120s';

-- get_rent_trends_by_county overloads
ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean)
    SET statement_timeout TO '120s';

ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean, text)
    SET statement_timeout TO '120s';

-- get_rent_trends_by_msa overloads
ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean)
    SET statement_timeout TO '120s';

ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean, text)
    SET statement_timeout TO '120s';

-- get_comps
ALTER FUNCTION public.get_comps(double precision, double precision, double precision, integer, integer, numeric, integer, integer, text, integer, text, boolean, integer[], text)
    SET statement_timeout TO '120s';
