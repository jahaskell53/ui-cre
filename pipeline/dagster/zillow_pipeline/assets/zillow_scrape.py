import time
from datetime import datetime, timezone
from typing import Optional

from apify_client.errors import ApifyApiError
from dagster import AssetExecutionContext, Backoff, Config, Failure, Output, RetryPolicy, asset
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource


class ZillowScrapeConfig(Config):
    run_id: Optional[str] = None  # if set, resumes a previous run under that run_id


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def raw_zillow_scrapes(
    context: AssetExecutionContext,
    config: ZillowScrapeConfig,
    ba_zip_codes: list[str],
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    run_id = config.run_id if config.run_id else context.run_id
    scraped_at = datetime.now(timezone.utc).isoformat()
    client = supabase.get_client()
    inserted = 0
    failed = []

    existing = (
        client.table("raw_zillow_scrapes")
        .select("zip_code")
        .eq("run_id", run_id)
        .execute()
    ).data
    already_scraped = {row["zip_code"] for row in existing}
    if already_scraped:
        context.log.info(f"Skipping {len(already_scraped)} already-scraped zip codes from previous attempt.")

    for zip_code in ba_zip_codes:
        if zip_code in already_scraped:
            context.log.info(f"Skipping already-scraped zip code {zip_code}")
            inserted += 1
            continue
        context.log.info(f"Scraping zip code {zip_code}")
        try:
            data = apify.run_zillow_search(zip_code)
            client.table("raw_zillow_scrapes").insert(
                {
                    "zip_code": zip_code,
                    "scraped_at": scraped_at,
                    "run_id": run_id,
                    "raw_json": data,
                }
            ).execute()
            inserted += 1
            context.log.info(f"Inserted {zip_code} ({inserted}/{len(ba_zip_codes)})")
        except ApifyApiError as e:
            context.log.error(f"Failed {zip_code}: [{e.status_code}] {e.type} — {e.message}")
            failed.append(zip_code)
            if e.status_code in (402, 429) or (e.type and "hard_limit" in e.type.lower()):
                raise Failure(
                    description=f"Apify monthly credit limit exceeded after {inserted} zip codes. Top up credits and re-run.",
                    allow_retries=False,
                )
        except Exception as e:
            context.log.error(f"Failed {zip_code}: {e}")
            failed.append(zip_code)
        time.sleep(1)

    if failed:
        context.log.warning(f"Failed zip codes ({len(failed)}): {failed}")
        raise Exception(f"{len(failed)} zip codes failed. Inserted {inserted}/{len(ba_zip_codes)}.")

    return Output(
        value=inserted,
        metadata={
            "zip_count": len(ba_zip_codes),
            "inserted": inserted,
            "failed": len(failed),
            "scraped_at": scraped_at,
            "run_id": run_id,
        },
    )
