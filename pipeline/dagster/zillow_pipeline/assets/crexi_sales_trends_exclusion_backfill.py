from dagster import AssetExecutionContext, Output, StaticPartitionsDefinition, asset

from zillow_pipeline.lib.crexi_sales_trends_exclusion_backfill import (
    BATCH_SIZE,
    backfill_crexi_sales_trends_exclusion_partition,
)
from zillow_pipeline.resources.supabase import SupabaseResource

# Current production max crexi_api_comps.id was 301983 when this one-time
# backfill was added; 302 partitions cover ids 1-302000 at 1000 rows each.
PARTITION_COUNT = 302
PARTITIONS = StaticPartitionsDefinition([f"{i:06d}" for i in range(PARTITION_COUNT)])


@asset(partitions_def=PARTITIONS)
def crexi_sales_trends_exclusion_backfill(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[int]:
    """Backfill one batch of Crexi comps that should be excluded from sales trends."""
    stats = backfill_crexi_sales_trends_exclusion_partition(
        supabase.get_client(),
        context.partition_key,
        batch_size=BATCH_SIZE,
    )
    context.log.info(
        "Crexi sales-trends exclusion partition %s: ids %d-%d, updated=%d",
        context.partition_key,
        stats["start_id"],
        stats["end_id"],
        stats["updated"],
    )
    return Output(
        value=stats["updated"],
        metadata={
            "partition_key": context.partition_key,
            "start_id": stats["start_id"],
            "end_id": stats["end_id"],
            "updated": stats["updated"],
        },
    )
