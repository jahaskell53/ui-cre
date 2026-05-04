from typing import Optional

from dagster import Config, OpExecutionContext, job, op

from zillow_pipeline.lib.crexi_run_lineage_backfill import run_crexi_lineage_backfill


class BackfillCrexiRunLineageConfig(Config):
    """Launch config for backfill_crexi_run_lineage_job (set in Dagster UI).

    dry_run  – log what would be changed without writing anything.
    page_size – rows per upsert batch (default 500 is a good balance of
                throughput vs PostgREST request size).
    limit    – stop after updating this many rows per table (useful for smoke
               tests; omit to process all rows).
    """

    dry_run: bool = False
    page_size: int = 500
    limit: Optional[int] = None


@op(required_resource_keys={"supabase"}, name="backfill_crexi_run_lineage_op")
def backfill_crexi_run_lineage_op(
    context: OpExecutionContext,
    config: BackfillCrexiRunLineageConfig,
) -> dict[str, int]:
    """Stamp pre-existing Crexi bronze rows with a legacy-import run_id (OPE-237)."""
    client = context.resources.supabase.get_client()
    stats = run_crexi_lineage_backfill(
        client,
        dry_run=config.dry_run,
        page_size=config.page_size,
        limit=config.limit,
    )
    mode = "dry-run" if config.dry_run else "apply"
    context.log.info(
        "backfill_crexi_run_lineage (%s): "
        "raw_updated=%d, detail_updated=%d, errors=%d",
        mode,
        stats["raw_updated"],
        stats["detail_updated"],
        stats["errors"],
    )
    return stats


# Dagster+ run monitoring applies a deployment max runtime; this backfill does
# thousands of PostgREST upserts (~290k raw + ~286k detail rows) and needs headroom.
_CREXI_LINEAGE_MAX_RUNTIME_SECONDS = 4 * 60 * 60


@job(
    name="backfill_crexi_run_lineage_job",
    tags={"dagster/max_runtime": str(_CREXI_LINEAGE_MAX_RUNTIME_SECONDS)},
)
def backfill_crexi_run_lineage_job():
    backfill_crexi_run_lineage_op()
