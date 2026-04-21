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

    # Collect unique listing URLs from the search results (first hit wins for metadata)
    seen_urls: set[str] = set()
    listing_entries: list[tuple[str, dict]] = []
    for row in search_rows:
        for item in row["raw_json"] or []:
            url = item.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                listing_entries.append((url, item if isinstance(item, dict) else {}))

    context.log.info(f"Found {len(listing_entries)} unique listing URLs in run {run_id}")

    known_rows = (
        client.table("loopnet_listings").select("listing_url").execute()
    ).data
    known_listing_urls = {
        row["listing_url"] for row in (known_rows or []) if row.get("listing_url")
    }
    if known_listing_urls:
        context.log.info(
            f"{len(known_listing_urls)} listing URLs already in loopnet_listings "
            "(detail scrape will run only for URLs not in that set)."
        )

    # Skip listings already scraped in this run
    existing = (
        client.table("raw_loopnet_detail_scrapes")
        .select("listing_url")
        .eq("run_id", run_id)
        .execute()
    ).data
    already_scraped = {row["listing_url"] for row in existing}
    if already_scraped:
        context.log.info(f"Skipping {len(already_scraped)} already-scraped listings.")

    scraped_at = datetime.now(timezone.utc).isoformat()
    inserted = failed = skipped = skipped_known = 0

    for listing_url, search_item in listing_entries:
        if listing_url in already_scraped:
            context.log.info(f"Skipping already-scraped: {listing_url}")
            skipped += 1
            continue

        if listing_url in known_listing_urls:
            label = (search_item.get("name") or search_item.get("title") or "").strip()
            synthetic = _strip_null_bytes(
                [
                    {
                        "inputUrl": listing_url,
                        "listingUrl": listing_url,
                        "fromSearchOnly": True,
                        "address": label,
                    }
                ]
            )
            client.table("raw_loopnet_detail_scrapes").insert(
                {
                    "run_id": run_id,
                    "scraped_at": scraped_at,
                    "listing_url": listing_url,
                    "raw_json": synthetic,
                }
            ).execute()
            inserted += 1
            skipped_known += 1
            context.log.info(
                f"Skipping Apify detail (known listing), stored search snapshot: {listing_url}"
            )
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
            "listings_found": len(listing_entries),
            "skipped": skipped,
            "skipped_known_listing": skipped_known,
            "inserted": inserted,
            "failed": failed,
        },
    )
