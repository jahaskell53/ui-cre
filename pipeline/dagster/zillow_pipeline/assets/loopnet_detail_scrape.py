from datetime import datetime, timezone
from typing import Optional

from apify_client.errors import ApifyApiError
from dagster import AssetExecutionContext, Backoff, Config, Failure, Output, RetryPolicy, asset

from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource
from zillow_pipeline.assets.loopnet_search_scrape import raw_loopnet_search_scrapes


class LoopnetDetailScrapeConfig(Config):
    run_id: Optional[str] = None  # if None, uses the latest run


def _strip_null_bytes(value):
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, list):
        return [_strip_null_bytes(item) for item in value]
    if isinstance(value, dict):
        return {key: _strip_null_bytes(item) for key, item in value.items()}
    return value


def _fetch_existing_detail_urls(client, page_size: int = 1000) -> set[str]:
    """Return all listing_url values already in loopnet_listing_details."""
    urls: set[str] = set()
    offset = 0
    while True:
        rows = (
            client.table("loopnet_listing_details")
            .select("listing_url")
            .range(offset, offset + page_size - 1)
            .execute()
        ).data or []
        if not rows:
            break
        for row in rows:
            u = row.get("listing_url")
            if u:
                urls.add(u)
        if len(rows) < page_size:
            break
        offset += page_size
    return urls


@asset(
    deps=[raw_loopnet_search_scrapes],
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def raw_loopnet_detail_scrapes(
    context: AssetExecutionContext,
    config: LoopnetDetailScrapeConfig,
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    client = supabase.get_client()

    if config.run_id:
        run_id = config.run_id
    else:
        result = (
            client.table("raw_loopnet_search_scrapes")
            .select("run_id")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            context.log.warning("No raw_loopnet_search_scrapes found.")
            return Output(value=0, metadata={"inserted": 0})
        run_id = result.data[0]["run_id"]

    context.log.info(f"Scraping LoopNet detail pages for run_id: {run_id}")

    search_rows = (
        client.table("raw_loopnet_search_scrapes")
        .select("raw_json")
        .eq("run_id", run_id)
        .execute()
    ).data

    # Collect unique listing URLs from the search results
    seen_urls: set[str] = set()
    listing_urls: list[str] = []
    for row in search_rows:
        for item in row["raw_json"] or []:
            url = item.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                listing_urls.append(url)

    context.log.info(f"Found {len(listing_urls)} unique listing URLs in run {run_id}")

    # Skip listings already scraped in this run (raw table)
    existing = (
        client.table("raw_loopnet_detail_scrapes")
        .select("listing_url")
        .eq("run_id", run_id)
        .execute()
    ).data
    already_scraped = {row["listing_url"] for row in existing}

    # Skip listings already in loopnet_listing_details (detail already captured)
    already_detailed = _fetch_existing_detail_urls(client)
    skip_detailed = already_detailed - already_scraped
    if skip_detailed:
        context.log.info(
            f"Skipping {len(skip_detailed & set(listing_urls))} listing(s) "
            f"already in loopnet_listing_details."
        )

    combined_skip = already_scraped | already_detailed
    if already_scraped:
        context.log.info(f"Skipping {len(already_scraped)} already-scraped listings (this run).")

    scraped_at = datetime.now(timezone.utc).isoformat()
    inserted = failed = skipped = 0

    for listing_url in listing_urls:
        if listing_url in combined_skip:
            skipped += 1
            continue

        context.log.info(f"Scraping detail: {listing_url}")
        try:
            raw_json = apify.run_loopnet_detail(listing_url)
            sanitized_raw_json = _strip_null_bytes(raw_json)
            client.table("raw_loopnet_detail_scrapes").insert(
                {
                    "run_id": run_id,
                    "scraped_at": scraped_at,
                    "listing_url": listing_url,
                    "raw_json": sanitized_raw_json,
                }
            ).execute()
            inserted += 1
            context.log.info(f"Inserted detail for {listing_url} ({inserted} so far)")
        except ApifyApiError as e:
            context.log.error(f"Apify error for {listing_url}: [{e.status_code}] {e.type} — {e.message}")
            failed += 1
            if e.status_code in (402, 429) or (e.type and "hard_limit" in e.type.lower()):
                raise Failure(
                    description=f"Apify monthly credit limit exceeded after {inserted} listings. Top up credits and re-run.",
                    allow_retries=False,
                )
        except Exception as e:
            context.log.error(f"Failed detail for {listing_url}: {e}")
            failed += 1

    if failed > 0:
        raise Exception(f"{failed} detail pages failed to scrape. Check logs for details.")

    return Output(
        value=inserted,
        metadata={
            "run_id": run_id,
            "listings_found": len(listing_urls),
            "skipped": skipped,
            "inserted": inserted,
            "failed": failed,
        },
    )
