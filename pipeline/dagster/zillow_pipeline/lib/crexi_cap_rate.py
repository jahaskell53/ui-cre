"""Fetch cap rate from the Crexi property detail endpoint for null-cap-rate rows.

Strategy
--------
* Query crexi_api_comps for rows where both cap rate columns are NULL and
  detail_fetched_at is NULL (not yet attempted), filtering to sales comps
  sold within the past ``years_back`` years.
* For each row, extract the numeric property ID from crexi_id (format:
  ``PREFIX~<id>`` e.g. ``SALES~2435663``).
* Call the Crexi property detail endpoint using the provided Bearer token.
* Parse cap rate from the detail response (preferring saleTransaction over
  financials, mirroring the existing flatten() logic in scrape_crexi.sh).
* Update the row with the new cap rate value and ``cap_rate_source = 'api_detail'``.
* Always record ``detail_fetched_at`` so the row is not retried on the next run,
  even when the detail endpoint returns no cap rate.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Optional

from supabase import Client

logger = logging.getLogger(__name__)

# Property detail endpoint.  The numeric ID follows the tilde in crexi_id.
CREXI_DETAIL_URL = "https://api.crexi.com/assets/{property_id}"

_PAGE_SIZE = 200


def _extract_property_id(crexi_id: Optional[str]) -> Optional[str]:
    """Return the numeric property ID from a Crexi record ID like ``SALES~2435663``."""
    if not crexi_id:
        return None
    if "~" in crexi_id:
        return crexi_id.rsplit("~", 1)[-1]
    return crexi_id


def _parse_cap_rate(detail: dict) -> Optional[float]:
    """Extract the best available cap rate from a Crexi detail response.

    Prefers saleTransaction.capRatePercent, falls back to
    financials.capRatePercent.  Returns None when neither is present or the
    value is zero (not meaningful).
    """
    sources = [
        (detail.get("saleTransaction") or {}).get("capRatePercent"),
        (detail.get("financials") or {}).get("capRatePercent"),
    ]
    for raw in sources:
        if raw is None:
            continue
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue
        if value != 0:
            return value
    return None


def _fetch_property_detail(
    property_id: str,
    *,
    bearer_token: str,
    timeout: int = 15,
) -> Optional[dict]:
    """Call the Crexi detail endpoint and return parsed JSON, or None on error."""
    url = CREXI_DETAIL_URL.format(property_id=property_id)
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {bearer_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        logger.warning("Failed to fetch detail for property %s: %s", property_id, exc)
        return None
    except Exception as exc:
        logger.warning("Unexpected error fetching detail for property %s: %s", property_id, exc)
        return None


def run_crexi_cap_rate_backfill(
    client: Client,
    *,
    bearer_token: str,
    dry_run: bool = False,
    page_size: int = _PAGE_SIZE,
    limit: Optional[int] = None,
    request_delay: float = 0.5,
    years_back: int = 3,
) -> dict[str, int]:
    """Fetch cap rate from the Crexi detail endpoint for null-cap-rate rows.

    Only processes rows that:
    * Have ``is_sales_comp = true``
    * Have ``sale_transaction_date`` within the past ``years_back`` years
    * Have both ``sale_cap_rate_percent`` and ``financials_cap_rate_percent`` NULL
    * Have ``detail_fetched_at`` NULL (not yet attempted)

    Returns a stats dict with keys: scanned, updated, no_cap_rate_in_detail,
    errors.
    """
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=years_back * 365)).strftime(
        "%Y-%m-%d"
    )

    stats: dict[str, int] = {
        "scanned": 0,
        "updated": 0,
        "no_cap_rate_in_detail": 0,
        "errors": 0,
    }

    offset = 0
    while True:
        if limit is not None and stats["scanned"] >= limit:
            break

        rows = (
            client.table("crexi_api_comps")
            .select("id,crexi_id")
            .is_("sale_cap_rate_percent", "null")
            .not_.is_("sale_transaction_date", "null")
            .is_("detail_fetched_at", "null")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        ).data or []

        if not rows:
            break

        for row in rows:
            if limit is not None and stats["scanned"] >= limit:
                break

            stats["scanned"] += 1
            row_id = row["id"]
            crexi_id = row.get("crexi_id")

            property_id = _extract_property_id(crexi_id)
            if not property_id:
                logger.debug("Row id=%s has no usable crexi_id, skipping", row_id)
                continue

            detail = _fetch_property_detail(property_id, bearer_token=bearer_token)
            time.sleep(request_delay)

            if detail is None:
                stats["errors"] += 1
                continue

            now_iso = datetime.now(timezone.utc).isoformat()
            cap_rate = _parse_cap_rate(detail)

            if cap_rate is not None:
                payload: dict = {
                    "sale_cap_rate_percent": cap_rate,
                    "cap_rate_source": "api_detail",
                    "detail_fetched_at": now_iso,
                }
                stats["updated"] += 1
            else:
                # Mark as attempted so we don't retry; no cap rate found
                payload = {"detail_fetched_at": now_iso}
                stats["no_cap_rate_in_detail"] += 1

            if not dry_run:
                try:
                    client.table("crexi_api_comps").update(payload).eq("id", row_id).execute()
                except Exception as exc:
                    logger.error("Failed to update row id=%s: %s", row_id, exc)
                    stats["errors"] += 1

        if len(rows) < page_size:
            break
        offset += page_size

    return stats
