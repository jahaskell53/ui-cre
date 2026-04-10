-- Set a function-level statement_timeout on get_zillow_map_listings.
--
-- The authenticator role (used by PostgREST for all API calls) carries an 8s
-- session-level statement_timeout. get_zillow_map_listings scans historical
-- cleaned_listings data with a geometry index and ~200ms of planning overhead;
-- on a cold database or under load this can exceed 8s and return error 57014.
--
-- PostgREST reads proconfig from pg_proc and issues SET LOCAL at the start of
-- the RPC transaction, overriding the role timeout for this function only.
-- All other API endpoints remain at 8s.
ALTER FUNCTION public.get_zillow_map_listings(
    text, text, text, boolean,
    integer, integer, integer, integer,
    integer[], numeric, text[], text, text[],
    double precision, double precision, double precision, double precision
)
SET statement_timeout TO '30s';
