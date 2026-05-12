-- PostgREST (Supabase REST) still capped this RPC at ~8s when only using
-- set_config() inside the function body. Supabase documents long RPCs via
-- the API using a function-level SET clause instead:
-- https://supabase.com/docs/guides/database/postgres/timeouts#function-level

CREATE OR REPLACE FUNCTION public.refresh_unit_breakdown_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '2h'
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_latest;
    REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_historical;
END;
$$;
