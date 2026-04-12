"""
End-to-end check: read real raw_zillow_scrapes, parse, call insert_cleaned_listing (no Apify).

Skipped unless SUPABASE_URL and SUPABASE_SERVICE_KEY are set (e.g. in pipeline/dagster/.env).
Optional: INTEGRATION_CLEAN_LISTING_LIMIT (default 25), INTEGRATION_CLEAN_LISTING_RUN_ID.
"""

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from supabase import create_client

from zillow_pipeline.assets.cleaned_listings import clean_listings_from_raw_rows

pytestmark = pytest.mark.integration


def _env_ready() -> bool:
    root = Path(__file__).resolve().parents[1]
    load_dotenv(root / ".env")
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"))


skip_unless_supabase = pytest.mark.skipif(
    not _env_ready(),
    reason="Set SUPABASE_URL and SUPABASE_SERVICE_KEY (e.g. pipeline/dagster/.env) to run integration tests.",
)


@skip_unless_supabase
def test_clean_listings_from_latest_raw_run():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    client = create_client(url, key)

    run_id = os.environ.get("INTEGRATION_CLEAN_LISTING_RUN_ID")
    if not run_id:
        latest = (
            client.table("raw_zillow_scrapes")
            .select("run_id")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
        assert latest.data, "No rows in raw_zillow_scrapes"
        run_id = latest.data[0]["run_id"]

    limit = int(os.environ.get("INTEGRATION_CLEAN_LISTING_LIMIT", "25"))

    raw_rows = (
        client.table("raw_zillow_scrapes")
        .select("id, zip_code, scraped_at, raw_json")
        .eq("run_id", run_id)
        .execute()
    ).data
    assert raw_rows, f"No raw rows for run_id={run_id}"

    result = clean_listings_from_raw_rows(client, run_id, raw_rows, limit=limit)
    assert result.failed == 0, f"RPC failures: {result.failed}"
    assert result.total_processed >= 1, (
        "No non-townhouse listings in the first N entries; raise INTEGRATION_CLEAN_LISTING_LIMIT or set INTEGRATION_CLEAN_LISTING_RUN_ID"
    )
    assert result.inserted == result.total_processed
