from datetime import datetime, timezone

from apify_client.errors import ApifyApiError
from dagster import AssetExecutionContext, Backoff, Failure, Output, RetryPolicy, asset

from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource

LOOPNET_SEARCH_URL = (
    "https://www.loopnet.com/search/apartment-buildings/for-sale/1/"
    "?bb=37mtyq5j5O1j6ikg9D&view=map"
)


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def raw_loopnet_search_scrapes(
    context: AssetExecutionContext,
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    client = supabase.get_client()

    context.log.info(f"Scraping LoopNet search: {LOOPNET_SEARCH_URL}")
    try:
        data = apify.run_loopnet_search(LOOPNET_SEARCH_URL)
    except ApifyApiError as e:
        context.log.error(f"Apify error: [{e.status_code}] {e.type} — {e.message}")
        if e.status_code in (402, 429) or (e.type and "hard_limit" in e.type.lower()):
            raise Failure(
                description=f"Apify monthly credit limit exceeded. Top up credits and re-run.",
                allow_retries=False,
            )
        raise

    context.log.info(f"Scrape returned {len(data)} listings")

    client.table("raw_loopnet_search_scrapes").insert(
        {
            "run_id": context.run_id,
            "scraped_at": scraped_at,
            "search_url": LOOPNET_SEARCH_URL,
            "raw_json": data,
        }
    ).execute()

    context.log.info(f"Inserted {len(data)} listings into raw_loopnet_search_scrapes")

    return Output(
        value=len(data),
        metadata={
            "run_id": context.run_id,
            "search_url": LOOPNET_SEARCH_URL,
            "listings_found": len(data),
            "scraped_at": scraped_at,
        },
    )
