-- Raise statement_timeout and add work_mem on rent-trends and get_comps RPCs.
--
-- CI integration tests show these functions hitting 57014 (statement_timeout)
-- on SF Bay Area fixtures at the 30s limit set in:
--   20260410050000_map_rent_trends_statement_timeout.sql
--   20260410060000_remaining_rpcs_statement_timeout.sql
--
-- The 30s budget was calibrated against an early-stage dataset. The DB has
-- grown substantially (loopnet_listing_snapshots, loopnet_listing_details,
-- cleaned_listings). The spatial variants (by_neighborhood, by_county, by_msa)
-- and city ILIKE scans are the worst offenders on cold buffer cache.
--
-- Changes:
--   1. Raise statement_timeout to 120s on all get_map_rent_trends* variants.
--   2. Raise statement_timeout to 120s on all get_rent_trends* overloads.
--   3. Raise statement_timeout to 120s on get_comps (all arg-count overloads).
--   4. Add work_mem = '64MB' to all of the above to avoid disk sort spills on
--      the per-week/per-zip median aggregations.
--
-- ALTER FUNCTION must match exact argument type signatures; all known overloads
-- are covered below.

-- ── get_map_rent_trends* ─────────────────────────────────────────────────────

ALTER FUNCTION public.get_map_rent_trends(integer, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_map_rent_trends(integer, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_map_rent_trends_by_neighborhood(integer, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_map_rent_trends_by_neighborhood(integer, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_map_rent_trends_by_county(integer, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_map_rent_trends_by_county(integer, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_map_rent_trends_by_msa(integer, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_map_rent_trends_by_msa(integer, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_map_rent_trends_by_city(integer, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_map_rent_trends_by_city(integer, integer, boolean)
    SET work_mem = '64MB';

-- ── get_rent_trends overloads ────────────────────────────────────────────────

ALTER FUNCTION public.get_rent_trends(text, integer)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends(text, integer)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_rent_trends(text, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends(text, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_rent_trends(text, integer, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends(text, integer, boolean, text)
    SET work_mem = '64MB';

-- ── get_rent_trends_by_neighborhood overloads ────────────────────────────────

ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_neighborhood(integer[], integer, boolean, text)
    SET work_mem = '64MB';

-- ── get_rent_trends_by_city overloads ───────────────────────────────────────

ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_city(text, text, integer, boolean, text)
    SET work_mem = '64MB';

-- ── get_rent_trends_by_county overloads ─────────────────────────────────────

ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_county(text, text, integer, boolean, text)
    SET work_mem = '64MB';

-- ── get_rent_trends_by_msa overloads ────────────────────────────────────────

ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean)
    SET work_mem = '64MB';

ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean, text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_rent_trends_by_msa(text, integer, boolean, text)
    SET work_mem = '64MB';

-- ── get_comps ────────────────────────────────────────────────────────────────

ALTER FUNCTION public.get_comps(double precision, double precision, double precision, integer, integer, numeric, integer, integer, text, integer, text, boolean, integer[], text)
    SET statement_timeout = '120s';
ALTER FUNCTION public.get_comps(double precision, double precision, double precision, integer, integer, numeric, integer, integer, text, integer, text, boolean, integer[], text)
    SET work_mem = '64MB';
