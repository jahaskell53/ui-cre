-- Set function-level statement_timeout on all get_map_rent_trends* RPCs.
--
-- The authenticator role (PostgREST) carries an 8s session-level timeout.
-- These functions are expensive: get_map_rent_trends runs ~5s on a warm cache
-- and get_map_rent_trends_by_neighborhood runs ~4s, both reliably exceed 8s
-- under concurrent load. PostgREST reads proconfig and issues SET LOCAL at the
-- start of each RPC transaction, overriding the role timeout for these
-- functions only.
ALTER FUNCTION public.get_map_rent_trends(integer, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_map_rent_trends_by_neighborhood(integer, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_map_rent_trends_by_county(integer, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_map_rent_trends_by_msa(integer, integer, boolean)
    SET statement_timeout TO '30s';

ALTER FUNCTION public.get_map_rent_trends_by_city(integer, integer, boolean)
    SET statement_timeout TO '30s';
