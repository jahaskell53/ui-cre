"""Dagster job that fetches cap rate from the Crexi property detail endpoint.

For rows in crexi_api_comps where sale_cap_rate_percent IS NULL and
detail_fetched_at IS NULL, this job calls the Crexi /assets/{id} detail
endpoint, extracts cap rate, and stores it with cap_rate_source = 'api_detail'.

Only recently-sold properties (default: last 3 years) are targeted, as they are
most relevant for trend analysis.

Usage in Dagster UI Launchpad:
  - bearer_token (required): a valid Crexi API Bearer token extracted from an
    authenticated browser session (Chrome DevTools Network tab → any
    /assets or /universal-search request → Authorization header).
  - dry_run: set to true to log what would be updated without writing to DB.
  - limit: cap the number of rows processed per run (useful for smoke tests).
  - years_back: how far back to look for sold properties (default 3).
  - request_delay: seconds to sleep between API calls (default 0.5).
  - page_size: rows fetched per DB query page (default 200).
"""

import os
from typing import Optional

from dagster import Config, OpExecutionContext, job, op

from zillow_pipeline.lib.crexi_cap_rate import run_crexi_cap_rate_backfill


class CrexiCapRateBackfillConfig(Config):
    """Launch config for crexi_cap_rate_backfill_job."""

    bearer_token: Optional[str] = None
    """Crexi API Bearer token.  If omitted, falls back to CREXI_BEARER_TOKEN env var."""

    dry_run: bool = False
    """Log planned updates without writing to the database."""

    limit: Optional[int] = None
    """Maximum number of rows to process.  Leave blank for all eligible rows."""

    years_back: int = 3
    """How many years back to look for sold properties."""

    request_delay: float = 0.5
    """Seconds to sleep between Crexi API calls to avoid rate limiting."""

    page_size: int = 200
    """Rows to fetch per database query page."""


@op(required_resource_keys={"supabase"}, name="crexi_cap_rate_backfill_op")
def crexi_cap_rate_backfill_op(
    context: OpExecutionContext,
    config: CrexiCapRateBackfillConfig,
) -> dict[str, int]:
    """Fetch cap rate from the Crexi detail endpoint for null-cap-rate rows."""
    bearer_token = config.bearer_token or os.environ.get("CREXI_BEARER_TOKEN", "")
    if not bearer_token:
        raise RuntimeError(
            "No Crexi Bearer token provided.  Set bearer_token in the job config "
            "or set the CREXI_BEARER_TOKEN environment variable."
        )

    client = context.resources.supabase.get_client()
    mode = "dry-run" if config.dry_run else "apply"
    context.log.info(
        f"crexi_cap_rate_backfill ({mode}): "
        f"years_back={config.years_back}, "
        f"limit={config.limit!r}, "
        f"page_size={config.page_size}, "
        f"request_delay={config.request_delay}s"
    )

    stats = run_crexi_cap_rate_backfill(
        client,
        bearer_token=bearer_token,
        dry_run=config.dry_run,
        page_size=config.page_size,
        limit=config.limit,
        request_delay=config.request_delay,
        years_back=config.years_back,
    )

    context.log.info(
        f"crexi_cap_rate_backfill ({mode}) complete: "
        f"scanned={stats['scanned']}, "
        f"updated={stats['updated']}, "
        f"no_cap_rate_in_detail={stats['no_cap_rate_in_detail']}, "
        f"errors={stats['errors']}"
    )
    return stats


@job(name="crexi_cap_rate_backfill_job")
def crexi_cap_rate_backfill_job():
    crexi_cap_rate_backfill_op()
