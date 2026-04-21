from typing import Optional

from dagster import Config, OpExecutionContext, job, op

from zillow_pipeline.lib.loopnet_address_fields import run_loopnet_address_backfill


class BackfillLoopnetAddressFieldsConfig(Config):
    """Launch config for backfill_loopnet_address_fields_job (set in Dagster UI)."""

    run_id: Optional[int] = None
    dry_run: bool = False
    page_size: int = 200
    limit: Optional[int] = None


@op(required_resource_keys={"supabase"}, name="backfill_loopnet_address_fields_op")
def backfill_loopnet_address_fields_op(
    context: OpExecutionContext,
    config: BackfillLoopnetAddressFieldsConfig,
) -> dict[str, int]:
    """Recompute loopnet_listings address_* from address/location/city/state/zip (libpostal when installed)."""
    client = context.resources.supabase.get_client()
    stats = run_loopnet_address_backfill(
        client,
        run_id=config.run_id,
        dry_run=config.dry_run,
        page_size=config.page_size,
        limit=config.limit,
    )
    mode = "dry-run" if config.dry_run else "apply"
    context.log.info(
        f"backfill_loopnet_address_fields ({mode}): "
        f"scanned={stats['scanned']}, updated={stats['updated']}, unchanged={stats['unchanged']}, "
        f"skipped_empty={stats['skipped_empty']}, errors={stats['errors']}"
    )
    return stats


@job(name="backfill_loopnet_address_fields_job")
def backfill_loopnet_address_fields_job():
    backfill_loopnet_address_fields_op()
