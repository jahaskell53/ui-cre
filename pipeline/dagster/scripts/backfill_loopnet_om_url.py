#!/usr/bin/env python3
"""
Recompute loopnet_listings.om_url from existing attachment_urls using the same
rules as download_om_pdfs (see zillow_pipeline.lib.loopnet_om_selection).

Usage (from repo root or pipeline/dagster):
  cd pipeline/dagster && uv run python scripts/backfill_loopnet_om_url.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# package root: pipeline/dagster
_SCRIPT_DIR = Path(__file__).resolve().parent
_DAGSTER_ROOT = _SCRIPT_DIR.parent
if str(_DAGSTER_ROOT) not in sys.path:
    sys.path.insert(0, str(_DAGSTER_ROOT))

from zillow_pipeline.lib.loopnet_om_selection import resolve_om_url


def _normalize_attachment_urls(raw: object) -> list[dict[str, str]]:
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


def main() -> None:
    env_path = _DAGSTER_ROOT / ".env"
    if env_path.is_file():
        load_dotenv(env_path)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)

    updated = unchanged = skipped_no_attachments = errors = 0
    offset = 0
    page_size = 500

    while True:
        res = (
            client.table("loopnet_listings")
            .select("id, om_url, attachment_urls")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break

        for row in rows:
            listing_id = row.get("id")
            if not listing_id:
                continue
            built = _normalize_attachment_urls(row.get("attachment_urls"))
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
            except Exception as e:
                print(f"Update failed for {listing_id}: {e}", file=sys.stderr)
                errors += 1

        if len(rows) < page_size:
            break
        offset += page_size

    print(
        f"Done: updated={updated}, unchanged={unchanged}, "
        f"skipped_no_attachment_urls={skipped_no_attachments}, errors={errors}"
    )


if __name__ == "__main__":
    main()
