import time
from datetime import datetime, timezone

from apify_client.errors import ApifyApiError
from dagster import AssetExecutionContext, Backoff, Output, RetryPolicy, asset
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.supabase import SupabaseResource


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def raw_zillow_scrapes(
    context: AssetExecutionContext,
    ba_zip_codes: list[str],
    apify: ApifyResource,
    supabase: SupabaseResource,
) -> Output[int]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    client = supabase.get_client()
    inserted = 0
    failed = []

    credit_exhausted = False

    for zip_code in ba_zip_codes:
        context.log.info(f"Scraping zip code {zip_code}")
        try:
            data = apify.run_zillow_search(zip_code)
            client.table("raw_zillow_scrapes").insert(
                {
                    "zip_code": zip_code,
                    "scraped_at": scraped_at,
                    "run_id": context.run_id,
                    "raw_json": data,
                }
            ).execute()
            inserted += 1
            context.log.info(f"Inserted {zip_code} ({inserted}/{len(ba_zip_codes)})")
        except ApifyApiError as e:
            context.log.error(f"Failed {zip_code}: [{e.status_code}] {e.type} — {e.message}")
            failed.append(zip_code)
            if e.status_code in (402, 429) or (e.type and "hard_limit" in e.type.lower()):
                context.log.error("Apify credit limit hit — aborting remaining zip codes.")
                credit_exhausted = True
                break
        except Exception as e:
            context.log.error(f"Failed {zip_code}: {e}")
            failed.append(zip_code)
        time.sleep(1)

    remaining = len(ba_zip_codes) - inserted - len(failed)
    if failed:
        context.log.warning(f"Failed zip codes ({len(failed)}): {failed}")
    if credit_exhausted and remaining > 0:
        context.log.warning(f"{remaining} zip codes were not attempted due to credit exhaustion.")

    if failed:
        raise Exception(
            f"{len(failed)} zip codes failed (credit_exhausted={credit_exhausted}). "
            f"Inserted {inserted}/{len(ba_zip_codes)}."
        )

    return Output(
        value=inserted,
        metadata={
            "zip_count": len(ba_zip_codes),
            "inserted": inserted,
            "failed": len(failed),
            "scraped_at": scraped_at,
            "run_id": context.run_id,
        },
    )
