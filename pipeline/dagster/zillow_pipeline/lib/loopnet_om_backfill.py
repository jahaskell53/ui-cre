"""Recompute loopnet_listings.om_url from attachment_urls (no downloads)."""

from __future__ import annotations

import json
from typing import Any

from supabase import Client

from zillow_pipeline.lib.loopnet_om_selection import resolve_om_url


def normalize_attachment_urls(raw: object) -> list[dict[str, str]]:
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return []
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        su = item.get("source_url")
        u = item.get("url")
        if not isinstance(su, str) or not isinstance(u, str):
            continue
        su, u = su.strip(), u.strip()
        if not su or not u:
            continue
        entry: dict[str, str] = {"source_url": su, "url": u}
        desc = item.get("description")
        if isinstance(desc, str) and desc.strip():
            entry["description"] = desc.strip()
        out.append(entry)
    return out


def run_backfill(client: Client, page_size: int = 500) -> dict[str, int]:
    """
    Paginate loopnet_listings and set om_url from attachment_urls when it changes.

    Returns counts: updated, unchanged, skipped_no_attachment_urls, errors.
    """
    updated = unchanged = skipped_no_attachments = errors = 0
    offset = 0

    while True:
        res = (
            client.table("loopnet_listings")
            .select("id, om_url, attachment_urls")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows: list[dict[str, Any]] = res.data or []
        if not rows:
            break

        for row in rows:
            listing_id = row.get("id")
            if not listing_id:
                continue
            built = normalize_attachment_urls(row.get("attachment_urls"))
            if not built:
                skipped_no_attachments += 1
                continue

            new_om = resolve_om_url(built)
            if not new_om:
                errors += 1
                continue

            old_om = (row.get("om_url") or "").strip()
            if old_om == new_om:
                unchanged += 1
                continue

            try:
                client.table("loopnet_listings").update({"om_url": new_om}).eq("id", listing_id).execute()
                updated += 1
            except Exception:
                errors += 1

        if len(rows) < page_size:
            break
        offset += page_size

    return {
        "updated": updated,
        "unchanged": unchanged,
        "skipped_no_attachment_urls": skipped_no_attachments,
        "errors": errors,
    }
