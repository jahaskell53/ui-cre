-- Dagster asset refresh_unit_breakdown_views calls this RPC via PostgREST.
-- The pooler/session default statement_timeout is too low for full MV refreshes,
-- which caused: SQLSTATE 57014 "canceling statement due to statement timeout".
--
-- set_config(..., true) is transaction-local (SET LOCAL), so it only applies to
-- this RPC invocation and does not affect other pooled connections.

CREATE OR REPLACE FUNCTION public.refresh_unit_breakdown_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('statement_timeout', '3600000', true);

    REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_latest;
    REFRESH MATERIALIZED VIEW public.mv_unit_breakdown_historical;
END;
$$;
