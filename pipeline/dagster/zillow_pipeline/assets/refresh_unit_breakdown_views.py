from dagster import AssetExecutionContext, Output, asset

from zillow_pipeline.resources.supabase import SupabaseResource


@asset(deps=["cleaned_building_units"])
def refresh_unit_breakdown_views(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[None]:
    """Refresh the mv_unit_breakdown_latest and mv_unit_breakdown_historical
    materialized views after cleaned_building_units has completed.

    Calls the refresh_unit_breakdown_views() Postgres function via PostgREST RPC.
    Both views are refreshed inside a single transaction so they are always
    consistent with each other.
    """
    client = supabase.get_client()
    client.rpc("refresh_unit_breakdown_views", {}).execute()
    context.log.info("Refreshed mv_unit_breakdown_latest and mv_unit_breakdown_historical")
    return Output(value=None, metadata={"status": "refreshed"})
