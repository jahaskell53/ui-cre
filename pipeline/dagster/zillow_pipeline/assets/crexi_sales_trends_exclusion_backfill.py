from dagster import AssetExecutionContext, Output, StaticPartitionsDefinition, asset

from zillow_pipeline.lib.crexi_sales_trends_exclusion_backfill import (
    BATCH_SIZE,
    backfill_crexi_sales_trends_exclusion_partition,
)
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource

# Current production max crexi_api_comps.id was 301983 when this one-time
# backfill was added; 302 partitions cover ids 1-302000 at 1000 rows each.
PARTITION_COUNT = 302
PARTITIONS = StaticPartitionsDefinition([f"{i:06d}" for i in range(PARTITION_COUNT)])


@asset(partitions_def=PARTITIONS)
def crexi_sales_trends_exclusion_backfill(
    context: AssetExecutionContext,
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    """Backfill one batch of Crexi comps that should be excluded from sales trends."""
    stats = backfill_crexi_sales_trends_exclusion_partition(
        supabase.get_client(),
        apify,
        context.partition_key,
        batch_size=BATCH_SIZE,
    )
    context.log.info(
        "Crexi sales-trends exclusion partition %s: ids %d-%d, updated=%d, one_unit=%d, zillow_scraped=%d, zillow_matched=%d, zillow_excluded=%d, probable_single_unit_excluded=%d",
        context.partition_key,
        stats["start_id"],
        stats["end_id"],
        stats["updated"],
        stats["one_unit_updated"],
        stats["zillow_scraped"],
        stats["zillow_matched"],
        stats["zillow_excluded_updated"],
        stats["probable_single_unit_excluded_updated"],
    )
    return Output(
        value=stats["updated"],
        metadata={
            "partition_key": context.partition_key,
            "start_id": stats["start_id"],
            "end_id": stats["end_id"],
            "updated": stats["updated"],
            "one_unit_updated": stats["one_unit_updated"],
            "zillow_scraped": stats["zillow_scraped"],
            "zillow_matched": stats["zillow_matched"],
            "zillow_excluded_updated": stats["zillow_excluded_updated"],
            "probable_single_unit_excluded_updated": stats["probable_single_unit_excluded_updated"],
        },
    )
