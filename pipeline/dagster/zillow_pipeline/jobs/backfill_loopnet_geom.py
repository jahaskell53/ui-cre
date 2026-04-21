from typing import Optional

from dagster import Config, OpExecutionContext, job, op

from zillow_pipeline.lib.loopnet_geom import run_loopnet_geom_backfill


class BackfillLoopnetGeomConfig(Config):
    """Launch config for backfill_loopnet_geom_job (set in Dagster UI)."""

    run_id: Optional[int] = None
    dry_run: bool = False
    page_size: int = 200
    limit: Optional[int] = None
    geocode_delay: float = 0.2


@op(required_resource_keys={"supabase"}, name="backfill_loopnet_geom_op")
def backfill_loopnet_geom_op(
    context: OpExecutionContext,
    config: BackfillLoopnetGeomConfig,
) -> dict[str, int]:
    """Populate loopnet_listings.geom from lat/lng (pass 1) or Mapbox geocoding (pass 2)."""
    client = context.resources.supabase.get_client()
    stats = run_loopnet_geom_backfill(
        client,
        run_id=config.run_id,
        dry_run=config.dry_run,
        page_size=config.page_size,
        limit=config.limit,
        geocode_delay=config.geocode_delay,
    )
    mode = "dry-run" if config.dry_run else "apply"
    context.log.info(
        f"backfill_loopnet_geom ({mode}): "
        f"scanned={stats['scanned']}, "
        f"updated_from_coords={stats['updated_from_coords']}, "
        f"geocoded={stats['geocoded']}, "
        f"geocode_failed={stats['geocode_failed']}, "
        f"skipped_no_address={stats['skipped_no_address']}, "
        f"errors={stats['errors']}"
    )
    return stats


@job(name="backfill_loopnet_geom_job")
def backfill_loopnet_geom_job():
    backfill_loopnet_geom_op()
