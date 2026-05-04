"""Backfill run lineage on existing Crexi bronze rows (OPE-237).

After the 20260504005100_crexi_scrape_runs_lineage migration lands, all
pre-existing rows in crexi_api_comp_raw_json and crexi_api_comp_detail_json
have run_id = NULL and fetched_at = now() (the migration column default).

This function:
  1. Inserts one 'legacy-import' row into crexi_scrape_runs.
  2. Pages through crexi_api_comp_raw_json WHERE run_id IS NULL and batch-
     upserts {crexi_id, run_id, fetched_at=updated_at}.
  3. Pages through crexi_api_comp_detail_json WHERE run_id IS NULL and does
     the same.

Pages are fetched via SQL RPCs (fetch_crexi_*_lineage_backfill_page) that set
a higher statement_timeout than PostgREST's default session cap, and use
keyset pagination (crexi_id > cursor) instead of OFFSET so each page stays cheap
once rows start clearing from the partial index.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from supabase import Client

logger = logging.getLogger(__name__)

_FETCH_RPC_BY_TABLE: dict[str, str] = {
    "crexi_api_comp_raw_json": "fetch_crexi_raw_lineage_backfill_page",
    "crexi_api_comp_detail_json": "fetch_crexi_detail_lineage_backfill_page",
}


def run_crexi_lineage_backfill(
    client: Client,
    *,
    dry_run: bool = False,
    page_size: int = 500,
    limit: Optional[int] = None,
) -> dict[str, int]:
    """Stamp existing bronze rows with a legacy-import run_id.

    Returns counts: raw_updated, detail_updated, errors.
    """
    page_size = max(1, min(page_size, 5000))
    stats: dict[str, int] = {"raw_updated": 0, "detail_updated": 0, "errors": 0}

    # ── 1. Insert the legacy-import scrape_runs row ──────────────────────────
    if dry_run:
        logger.info("dry-run: would insert legacy-import row into crexi_scrape_runs")
        legacy_run_id = -1
    else:
        run_resp = (
            client.table("crexi_scrape_runs")
            .insert(
                {
                    "source": "legacy-import",
                    "status": "completed",
                    "notes": "Backfill row for OPE-237; owns every bronze row that pre-dates run_id.",
                }
            )
            .execute()
        )
        inserted = run_resp.data or []
        if not inserted:
            raise RuntimeError("Failed to insert legacy-import row into crexi_scrape_runs")
        legacy_run_id = inserted[0]["run_id"]
        logger.info("Inserted legacy-import run_id=%s", legacy_run_id)

    # ── 2. Backfill crexi_api_comp_raw_json ──────────────────────────────────
    stats["raw_updated"] = _backfill_table(
        client,
        table="crexi_api_comp_raw_json",
        pk="crexi_id",
        legacy_run_id=legacy_run_id,
        page_size=page_size,
        limit=limit,
        dry_run=dry_run,
        stats=stats,
        errors_key="errors",
    )

    # ── 3. Backfill crexi_api_comp_detail_json ───────────────────────────────
    stats["detail_updated"] = _backfill_table(
        client,
        table="crexi_api_comp_detail_json",
        pk="crexi_id",
        legacy_run_id=legacy_run_id,
        page_size=page_size,
        limit=limit,
        dry_run=dry_run,
        stats=stats,
        errors_key="errors",
    )

    return stats


def _fetch_lineage_page(
    client: Client,
    *,
    table: str,
    after_crexi_id: Optional[str],
    page_size: int,
) -> list[dict[str, Any]]:
    rpc = _FETCH_RPC_BY_TABLE[table]
    payload: dict[str, Any] = {"p_after_crexi_id": after_crexi_id, "p_limit": page_size}
    return (client.rpc(rpc, payload).execute()).data or []


def _backfill_table(
    client: Client,
    *,
    table: str,
    pk: str,
    legacy_run_id: int,
    page_size: int,
    limit: Optional[int],
    dry_run: bool,
    stats: dict[str, int],
    errors_key: str,
) -> int:
    """Walk rows with run_id IS NULL in crexi_id order; upsert each page."""
    updated = 0
    after_crexi_id: Optional[str] = None

    while True:
        if limit is not None and updated >= limit:
            break

        rows = _fetch_lineage_page(
            client,
            table=table,
            after_crexi_id=after_crexi_id,
            page_size=page_size,
        )

        if not rows:
            break

        page_count = len(rows)
        last_id = rows[-1][pk]

        if dry_run:
            logger.info("dry-run: would upsert %d rows into %s", page_count, table)
            updated += page_count
        else:
            batch = [
                {
                    pk: row[pk],
                    "run_id": legacy_run_id,
                    "fetched_at": row["updated_at"],
                }
                for row in rows
            ]
            try:
                client.table(table).upsert(batch, on_conflict=pk).execute()
                updated += page_count
            except Exception as exc:
                logger.error(
                    "Batch upsert failed on %s after_crexi_id=%r: %s",
                    table,
                    after_crexi_id,
                    exc,
                )
                stats[errors_key] += 1
                after_crexi_id = last_id
                continue

        after_crexi_id = last_id

        if page_count < page_size:
            break

    return updated
