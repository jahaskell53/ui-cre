from datetime import datetime, timezone
from typing import Optional

from dagster import AssetExecutionContext, Backoff, Config, Output, RetryPolicy, asset

from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource


class BuildingScrapeConfig(Config):
    run_id: Optional[str] = None  # if None, uses the latest run


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def raw_building_scrapes(
    context: AssetExecutionContext,
    config: BuildingScrapeConfig,
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    client = supabase.get_client()

    # Resolve run_id
    if config.run_id:
        run_id = config.run_id
    else:
        result = (
            client.table("raw_zillow_scrapes")
            .select("run_id")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            context.log.warning("No raw scrapes found.")
            return Output(value=0, metadata={"inserted": 0})
        run_id = result.data[0]["run_id"]

    context.log.info(f"Scraping buildings for run_id: {run_id}")

    raw_rows = (
        client.table("raw_zillow_scrapes")
        .select("raw_json")
        .eq("run_id", run_id)
        .execute()
    ).data

    # Collect unique buildings by detailUrl
    seen_urls: set[str] = set()
    buildings: list[dict] = []
    for raw_row in raw_rows:
        for listing in raw_row["raw_json"] or []:
            if not listing.get("isBuilding"):
                continue
            detail_url = listing.get("detailUrl")
            if not detail_url or detail_url in seen_urls:
                continue
            seen_urls.add(detail_url)
            buildings.append(listing)

    context.log.info(f"Found {len(buildings)} unique buildings in run {run_id}")

    # Find buildings already scraped for this run_id
    existing = (
        client.table("raw_building_details")
        .select("detail_url")
        .eq("run_id", run_id)
        .execute()
    ).data
    already_scraped = {row["detail_url"] for row in existing}

    scraped_at = datetime.now(timezone.utc).isoformat()
    inserted = failed = skipped = 0

    for listing in buildings:
        detail_url = listing["detailUrl"]
        building_zpid = str(listing.get("zpid") or "")

        if detail_url in already_scraped:
            context.log.info(f"Skipping already-scraped building {building_zpid}")
            skipped += 1
            continue

        context.log.info(f"Scraping building zpid={building_zpid} url={detail_url}")
        try:
            raw_json = apify.run_zillow_detail(detail_url)
            client.table("raw_building_details").insert(
                {
                    "run_id": run_id,
                    "scraped_at": scraped_at,
                    "building_zpid": building_zpid,
                    "detail_url": detail_url,
                    "raw_json": raw_json,
                }
            ).execute()
            inserted += 1
            context.log.info(f"Inserted building {building_zpid} ({inserted} so far)")
        except Exception as e:
            context.log.error(f"Failed building zpid={building_zpid}: {e}")
            failed += 1

    if failed > 0:
        raise Exception(f"{failed} buildings failed to scrape. Check logs for details.")

    return Output(
        value=inserted,
        metadata={
            "run_id": run_id,
            "buildings_found": len(buildings),
            "skipped": skipped,
            "inserted": inserted,
            "failed": failed,
        },
    )
