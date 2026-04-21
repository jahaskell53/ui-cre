#!/usr/bin/env python3
"""
Backfill loopnet_listings.address_* using the same rules as cleaned_loopnet_listings
(libpostal via postal.parser when libpostal is installed).

Usage (from pipeline/dagster with venv and postal/libpostal available):
  cd pipeline/dagster && .venv/bin/python scripts/backfill_loopnet_address_fields.py --run-id 2

Options:
  --run-id INT     Only update rows with this loopnet_listings.run_id (recommended).
  --dry-run        Print counts only; no updates.
  --page-size INT  Rows per fetch (default 200).
  --limit INT      Stop after processing at most this many rows (for smoke tests).

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

_SCRIPT_DIR = Path(__file__).resolve().parent
_DAGSTER_ROOT = _SCRIPT_DIR.parent
if str(_DAGSTER_ROOT) not in sys.path:
    sys.path.insert(0, str(_DAGSTER_ROOT))

from zillow_pipeline.lib.loopnet_address_fields import build_address_fields_from_row


def _fields_equal(row: dict, desired: dict) -> bool:
    for k in ("address_raw", "address_street", "address_city", "address_state", "address_zip"):
        cur = (row.get(k) or "") or ""
        nxt = desired.get(k) or ""
        if cur != nxt:
            return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill loopnet_listings address_* columns.")
    parser.add_argument("--run-id", type=int, default=None, help="Filter to this run_id")
    parser.add_argument("--dry-run", action="store_true", help="Do not write updates")
    parser.add_argument("--page-size", type=int, default=200, help="Page size for select")
    parser.add_argument("--limit", type=int, default=None, help="Max rows to process")
    args = parser.parse_args()

    env_path = _DAGSTER_ROOT / ".env"
    if env_path.is_file():
        load_dotenv(env_path)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)

    client = create_client(url, key)
    page_size = max(1, args.page_size)

    scanned = updated = unchanged = skipped_empty = errors = 0
    offset = 0

    while True:
        q = (
            client.table("loopnet_listings")
            .select("id,address,location,city,state,zip,address_raw,address_street,address_city,address_state,address_zip")
            .order("id")
        )
        if args.run_id is not None:
            q = q.eq("run_id", args.run_id)
        result = q.range(offset, offset + page_size - 1).execute()
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            if args.limit is not None and scanned >= args.limit:
                break

            scanned += 1
            rid = row.get("id")
            addr = row.get("address")
            loc = row.get("location")
            city = row.get("city")
            state = row.get("state")
            z = row.get("zip")

            if not (str(addr or "").strip() or str(loc or "").strip() or str(city or "").strip()):
                skipped_empty += 1
                continue

            desired = build_address_fields_from_row(addr, loc, city, state, z)
            if _fields_equal(row, desired):
                unchanged += 1
                continue

            if args.dry_run:
                updated += 1
                continue

            try:
                client.table("loopnet_listings").update(desired).eq("id", rid).execute()
                updated += 1
            except Exception as e:
                errors += 1
                print(f"Error updating id={rid}: {e}", file=sys.stderr)

        if args.limit is not None and scanned >= args.limit:
            break

        if len(rows) < page_size:
            break
        offset += page_size

    mode = "dry-run" if args.dry_run else "apply"
    print(
        f"Done ({mode}): scanned={scanned}, updated={updated}, unchanged={unchanged}, "
        f"skipped_empty={skipped_empty}, errors={errors}"
    )


if __name__ == "__main__":
    main()
