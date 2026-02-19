from datetime import datetime, timezone

from dagster import AssetExecutionContext, Output, asset
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource


@asset
def raw_zillow_scrapes(
    context: AssetExecutionContext,
    ba_zip_codes: list[str],
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    client = supabase.get_client()
    rows = []

    for zip_code in ba_zip_codes:
        context.log.info(f"Scraping zip code {zip_code}")
        data = apify.run_zillow_search(zip_code)
        rows.append(
            {
                "zip_code": zip_code,
                "scraped_at": scraped_at,
                "run_id": context.run_id,
                "raw_json": data,
            }
        )

    client.table("raw_zillow_scrapes").insert(rows).execute()
    context.log.info(f"Inserted {len(rows)} rows for run {context.run_id}")

    return Output(
        value=len(rows),
        metadata={
            "zip_count": len(ba_zip_codes),
            "scraped_at": scraped_at,
            "run_id": context.run_id,
        },
    )
