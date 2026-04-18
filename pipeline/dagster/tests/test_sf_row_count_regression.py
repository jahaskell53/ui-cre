"""Regression tests: SF row counts in cleaned_listings and unit-breakdown views.

These tests connect to the live Supabase database and assert that the number of
rows for San Francisco data stays above known-good thresholds.  They are skipped
automatically when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set in the
environment so that the normal unit-test suite (which mocks Supabase) is
unaffected.

Run them explicitly with:

    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... pytest tests/test_sf_row_count_regression.py -v

Or against the cloud environment where both vars are already injected.

Thresholds are set conservatively at roughly 60–75% of current observed values
so that temporary data loss or a partially-failed pipeline run does not mask a
real regression:

  Table / view                     Current      Threshold
  ─────────────────────────────────────────────────────────
  cleaned_listings (historical SF) 13 399       10 000
  cleaned_listings (latest run SF)  2 400        1 500
  mv_unit_breakdown_latest          1 958        1 000
  mv_unit_breakdown_historical      2 504        1 500
"""

import os
import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        pytest.skip(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to run regression tests"
        )
    from supabase import create_client
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SF_CITY_PATTERN = "San Francisco"

MIN_SF_HISTORICAL = 10_000
MIN_SF_LATEST = 1_500
MIN_MV_LATEST = 1_000
MIN_MV_HISTORICAL = 1_500


def _latest_run_id(client) -> str:
    result = (
        client.table("cleaned_listings")
        .select("run_id")
        .order("run_id", desc=True)
        .limit(1)
        .execute()
    )
    assert result.data, "cleaned_listings table is empty — cannot determine latest run_id"
    return result.data[0]["run_id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSfCleanedListingsRowCounts:
    """Assert cleaned_listings has enough SF rows for both historical and latest."""

    def test_sf_historical_row_count(self, supabase_client):
        """All historical SF rows across every run must exceed the threshold."""
        result = (
            supabase_client.table("cleaned_listings")
            .select("id", count="exact")
            .ilike("address_city", f"%{SF_CITY_PATTERN}%")
            .not_.ilike("address_city", "%South San Francisco%")
            .execute()
        )
        count = result.count
        assert count is not None, "count was not returned — check PostgREST response"
        assert count >= MIN_SF_HISTORICAL, (
            f"SF historical row count regression: got {count}, expected >= {MIN_SF_HISTORICAL}. "
            "Data may have been accidentally deleted or the scraper failed for multiple runs."
        )

    def test_sf_latest_run_row_count(self, supabase_client):
        """The most-recent scrape run must contain enough SF rows."""
        latest_run = _latest_run_id(supabase_client)
        result = (
            supabase_client.table("cleaned_listings")
            .select("id", count="exact")
            .eq("run_id", latest_run)
            .ilike("address_city", f"%{SF_CITY_PATTERN}%")
            .not_.ilike("address_city", "%South San Francisco%")
            .execute()
        )
        count = result.count
        assert count is not None
        assert count >= MIN_SF_LATEST, (
            f"SF latest-run row count regression: got {count} for run_id={latest_run!r}, "
            f"expected >= {MIN_SF_LATEST}. The most recent pipeline run may have failed "
            "or produced far fewer SF listings than normal."
        )


class TestUnitBreakdownViewRowCounts:
    """Assert the materialized unit-breakdown views are populated above threshold."""

    def test_mv_unit_breakdown_latest_row_count(self, supabase_client):
        """mv_unit_breakdown_latest must have enough building rows."""
        result = (
            supabase_client.table("mv_unit_breakdown_latest")
            .select("building_zpid", count="exact")
            .execute()
        )
        count = result.count
        assert count is not None
        assert count >= MIN_MV_LATEST, (
            f"mv_unit_breakdown_latest row count regression: got {count}, "
            f"expected >= {MIN_MV_LATEST}. The view may not have been refreshed "
            "after the last pipeline run, or cleaned_building_units inserted too few rows."
        )

    def test_mv_unit_breakdown_historical_row_count(self, supabase_client):
        """mv_unit_breakdown_historical must have enough building rows."""
        result = (
            supabase_client.table("mv_unit_breakdown_historical")
            .select("building_zpid", count="exact")
            .execute()
        )
        count = result.count
        assert count is not None
        assert count >= MIN_MV_HISTORICAL, (
            f"mv_unit_breakdown_historical row count regression: got {count}, "
            f"expected >= {MIN_MV_HISTORICAL}. The historical view may be stale or "
            "cleaned_building_units data may have been lost."
        )
