from datetime import datetime, timezone
from typing import Optional

from apify_client.errors import ApifyApiError
from dagster import AssetExecutionContext, Backoff, Config, Failure, Output, RetryPolicy, asset

from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource
from zillow_pipeline.assets.loopnet_search_scrape import raw_loopnet_search_scrapes


class LoopnetListingDetailsConfig(Config):
    run_id: Optional[str] = None  # if None, uses the latest search scrape run


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
    ),
)
def loopnet_listing_details(
    context: AssetExecutionContext,
    config: LoopnetListingDetailsConfig,
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    """Upsert Apify detail JSON into loopnet_listing_details (one row per listing_url)."""
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
            return Output(value=0, metadata={"apify_calls": 0})
        run_id = result.data[0]["run_id"]

    context.log.info(f"LoopNet listing details for search run_id: {run_id}")

    search_rows = (
        client.table("raw_loopnet_search_scrapes")
        .select("raw_json")
        .eq("run_id", run_id)
        .execute()
    ).data

    seen_urls: set[str] = set()
    listing_urls: list[str] = []
    for row in search_rows:
        for item in row["raw_json"] or []:
            url = item.get("url") if isinstance(item, dict) else None
            if url and url not in seen_urls:
                seen_urls.add(url)
                listing_urls.append(url)

    context.log.info(f"Found {len(listing_urls)} unique listing URLs in search run {run_id}")

    already: set[str] = set()
    chunk = 150
    for start in range(0, len(listing_urls), chunk):
        part = listing_urls[start : start + chunk]
        if not part:
            continue
        resp = (
            client.table("loopnet_listing_details")
            .select("listing_url")
            .in_("listing_url", part)
            .execute()
        ).data
        for row in resp or []:
            u = row.get("listing_url")
            if u:
                already.add(u)

    scraped_at = datetime.now(timezone.utc).isoformat()
    apify_calls = failed = skipped = 0

    for listing_url in listing_urls:
        if listing_url in already:
            context.log.info(f"Skipping Apify (detail already stored): {listing_url}")
            skipped += 1
            continue

        context.log.info(f"Scraping detail: {listing_url}")
        try:
            raw_json = apify.run_loopnet_detail(listing_url)
            sanitized_raw_json = _strip_null_bytes(raw_json)
            client.table("loopnet_listing_details").upsert(
                {
                    "listing_url": listing_url,
                    "scraped_at": scraped_at,
                    "raw_json": sanitized_raw_json,
                    "updated_at": scraped_at,
                },
                on_conflict="listing_url",
            ).execute()
            apify_calls += 1
            context.log.info(f"Upserted detail for {listing_url} ({apify_calls} Apify calls so far)")
        except ApifyApiError as e:
            context.log.error(f"Apify error for {listing_url}: [{e.status_code}] {e.type} — {e.message}")
            failed += 1
            if e.status_code in (402, 429) or (e.type and "hard_limit" in e.type.lower()):
                raise Failure(
                    description=f"Apify monthly credit limit exceeded after {apify_calls} listings. Top up credits and re-run.",
                    allow_retries=False,
                )
        except Exception as e:
            context.log.error(f"Failed detail for {listing_url}: {e}")
            failed += 1

    if failed > 0:
        raise Exception(f"{failed} detail pages failed to scrape. Check logs for details.")

    return Output(
        value=apify_calls,
        metadata={
            "search_run_id": run_id,
            "listings_found": len(listing_urls),
            "skipped_existing_detail": skipped,
            "apify_calls": apify_calls,
            "failed": failed,
        },
    )
