-- Drop the unused paginated overload of get_zillow_map_listings.
--
-- Two overloads exist with identical argument types except for trailing
-- p_limit/p_offset defaults. PostgREST cannot disambiguate between them
-- when all optional params are omitted, causing:
--   "Could not choose the best candidate function"
--
-- The application code never passes p_limit/p_offset, so the extra
-- overload is dead code. Dropping it restores working RPC calls.
DROP FUNCTION IF EXISTS public.get_zillow_map_listings(
    text, text, text, boolean, integer, integer, integer, integer,
    integer[], numeric, text[], text,
    double precision, double precision, double precision, double precision,
    integer, integer
);
