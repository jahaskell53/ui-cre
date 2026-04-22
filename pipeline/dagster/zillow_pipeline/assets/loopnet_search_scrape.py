from datetime import datetime, timezone
from typing import Optional

from apify_client.errors import ApifyApiError
from dagster import AssetExecutionContext, Backoff, Config, Failure, Output, RetryPolicy, asset

from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource

# Base URL for the LoopNet apartment-buildings-for-sale search in SF County.
# Uses list view (no &view=map) so all listings are rendered page-by-page rather
# than in a lazy-loading map sidebar that only shows an initial subset.
LOOPNET_SEARCH_BASE_URL = (
    "https://www.loopnet.com/search/apartment-buildings/for-sale/{page}/"
    "?bb=37mtyq5j5O1j6ikg9D"
)

# Number of result pages to fetch per run.  At 25 listings/page this covers up
# to 125 listings, comfortably above the ~71 currently shown for SF County.
LOOPNET_SEARCH_MAX_PAGES = 5


class LoopnetSearchScrapeConfig(Config):
    run_id: Optional[str] = None  # if set, resumes a previous run under that run_id


def _build_search_urls(max_pages: int = LOOPNET_SEARCH_MAX_PAGES) -> list[str]:
    """Return page URLs 1–max_pages for the SF apartment-buildings-for-sale search."""
    return [
        LOOPNET_SEARCH_BASE_URL.format(page=page)
        for page in range(1, max_pages + 1)
    ]


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def raw_loopnet_search_scrapes(
    context: AssetExecutionContext,
    config: LoopnetSearchScrapeConfig,
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    run_id = config.run_id if config.run_id else context.run_id
    scraped_at = datetime.now(timezone.utc).isoformat()
    client = supabase.get_client()

    # If resuming, check whether the search was already scraped for this run_id
    existing = (
        client.table("raw_loopnet_search_scrapes")
        .select("id")
        .eq("run_id", run_id)
        .execute()
    ).data
    if existing:
        context.log.info(
            f"LoopNet search already scraped for run_id={run_id}, skipping Apify call."
        )
        existing_count = (
            client.table("raw_loopnet_search_scrapes")
            .select("raw_json")
            .eq("run_id", run_id)
            .execute()
        ).data
        listings_found = sum(len(row.get("raw_json") or []) for row in existing_count)
        return Output(
            value=listings_found,
            metadata={
                "run_id": run_id,
                "search_urls": _build_search_urls(),
                "listings_found": listings_found,
                "scraped_at": scraped_at,
            },
        )

    search_urls = _build_search_urls()
    context.log.info(
        f"Scraping LoopNet search across {len(search_urls)} pages (list view, no map)"
    )
    try:
        data = apify.run_loopnet_search(search_urls)
    except ApifyApiError as e:
        context.log.error(f"Apify error: [{e.status_code}] {e.type} — {e.message}")
        if e.status_code in (402, 429) or (e.type and "hard_limit" in e.type.lower()):
            raise Failure(
                description=f"Apify monthly credit limit exceeded. Top up credits and re-run.",
                allow_retries=False,
            )
        raise

    # Deduplicate by listing URL in case the actor returns overlapping results
    # across pages (e.g. a listing promoted on multiple pages).
    seen: set[str] = set()
    unique_data: list[dict] = []
    for item in data:
        url = item.get("url") or ""
        if url and url in seen:
            continue
        seen.add(url)
        unique_data.append(item)

    context.log.info(
        f"Scrape returned {len(data)} raw results, {len(unique_data)} unique listings"
    )

    client.table("raw_loopnet_search_scrapes").insert(
        {
            "run_id": run_id,
            "scraped_at": scraped_at,
            "search_url": search_urls[0],
            "raw_json": unique_data,
        }
    ).execute()

    context.log.info(f"Inserted {len(unique_data)} listings into raw_loopnet_search_scrapes")

    return Output(
        value=len(unique_data),
        metadata={
            "run_id": run_id,
            "search_urls": search_urls,
            "listings_found": len(unique_data),
            "scraped_at": scraped_at,
        },
    )
