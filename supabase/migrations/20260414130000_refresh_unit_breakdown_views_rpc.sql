-- Postgres helper function called by the Dagster pipeline after each scrape run
-- to refresh the unit-breakdown materialized views (OPE-116).
--
-- REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a transaction block,
-- so this function uses non-concurrent refresh instead. For a weekly background
-- pipeline the brief exclusive lock (seconds at most) is acceptable, and it is
-- far preferable to skipping the refresh or requiring a separate out-of-band
-- connection.
--
-- The Dagster asset calls:
--   supabase.rpc("refresh_unit_breakdown_views", {}).execute()
--
-- PostgREST wraps the call in a single transaction; both refreshes complete
-- inside that transaction and the views are atomically updated together.

CREATE OR REPLACE FUNCTION public.refresh_unit_breakdown_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_latest;
    REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_historical;
END;
$$;
