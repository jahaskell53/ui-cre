#!/usr/bin/env python3
"""
Backfill loopnet_listing_details.address_* using the same rules as cleaned_loopnet_listings
(libpostal via postal.parser when libpostal is installed).

CLI (from pipeline/dagster with venv and postal/libpostal available):
  cd pipeline/dagster && .venv/bin/python scripts/backfill_loopnet_address_fields.py --run-id 2

Dagster UI: launch job **backfill_loopnet_address_fields_job** and set run config, e.g.:
  ops:
    backfill_loopnet_address_fields_op:
      config:
        run_id: 2
        dry_run: false

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

from zillow_pipeline.lib.loopnet_address_fields import run_loopnet_address_backfill


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill loopnet_listing_details address_* columns.")
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
    stats = run_loopnet_address_backfill(
        client,
        run_id=args.run_id,
        dry_run=args.dry_run,
        page_size=args.page_size,
        limit=args.limit,
    )
    mode = "dry-run" if args.dry_run else "apply"
    print(
        f"Done ({mode}): scanned={stats['scanned']}, updated={stats['updated']}, "
        f"unchanged={stats['unchanged']}, skipped_empty={stats['skipped_empty']}, errors={stats['errors']}"
    )


if __name__ == "__main__":
    main()
