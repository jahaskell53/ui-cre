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

Batch upsert (INSERT … ON CONFLICT DO UPDATE) is used so each page is a
single network round-trip rather than one UPDATE per row.
"""

from __future__ import annotations

import logging
from typing import Optional

from supabase import Client

logger = logging.getLogger(__name__)


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
    page_size = max(1, page_size)
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
    """Page through *table* WHERE run_id IS NULL and batch-upsert run_id + fetched_at.

    After each successful batch the updated rows no longer match
    ``run_id IS NULL``, so the next page always starts at offset 0.
    In dry-run mode rows are never modified, so offset advances normally.
    """
    updated = 0
    offset = 0

    while True:
        if limit is not None and updated >= limit:
            break

        rows = (
            client.table(table)
            .select(f"{pk},updated_at")
            .is_("run_id", "null")
            .order(pk)
            .range(offset, offset + page_size - 1)
            .execute()
        ).data or []

        if not rows:
            break

        page_count = len(rows)

        if dry_run:
            logger.info("dry-run: would upsert %d rows into %s", page_count, table)
            updated += page_count
            offset += page_size
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
                # Updated rows no longer have run_id IS NULL — restart from 0.
                offset = 0
            except Exception as exc:
                logger.error("Batch upsert failed on %s offset=%d: %s", table, offset, exc)
                stats[errors_key] += 1
                # Advance past this page so we don't loop forever on a bad batch.
                offset += page_size

        if page_count < page_size:
            break

    return updated
