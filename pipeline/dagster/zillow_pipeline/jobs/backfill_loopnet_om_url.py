from dagster import OpExecutionContext, job, op

from zillow_pipeline.lib.loopnet_om_backfill import run_backfill


@op(required_resource_keys={"supabase"}, name="backfill_loopnet_om_url_op")
def backfill_loopnet_om_url_op(context: OpExecutionContext) -> dict[str, int]:
    """Recompute om_url from existing attachment_urls (manual / UI job)."""
    client = context.resources.supabase.get_client()
    stats = run_backfill(client)
    context.log.info(
        "backfill_loopnet_om_url complete: "
        f"updated={stats['updated']}, unchanged={stats['unchanged']}, "
        f"skipped_no_attachment_urls={stats['skipped_no_attachment_urls']}, "
        f"errors={stats['errors']}"
    )
    return stats


@job(name="backfill_loopnet_om_url_job")
def backfill_loopnet_om_url_job():
    backfill_loopnet_om_url_op()
