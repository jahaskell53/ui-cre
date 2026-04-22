#!/usr/bin/env python3
"""
Backfill loopnet_listing_details.geom from existing lat/lng or Mapbox geocoding.

Pass 1: rows with latitude/longitude but no geom → set geom from coords.
Pass 2: rows with no lat/lng and no geom → geocode via Mapbox, then set geom.

CLI (from pipeline/dagster with venv active):
  cd pipeline/dagster && .venv/bin/python scripts/backfill_loopnet_geom.py

Dagster UI: launch job backfill_loopnet_geom_job with run config, e.g.:
  ops:
    backfill_loopnet_geom_op:
      config:
        run_id: 3
        dry_run: false
        geocode_delay: 0.2

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).
MAPBOX_TOKEN is optional; falls back to the hardcoded public token.
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

from zillow_pipeline.lib.loopnet_geom import run_loopnet_geom_backfill


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill loopnet_listing_details.geom column.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write updates")
    parser.add_argument("--page-size", type=int, default=200, help="Page size for select")
    parser.add_argument("--limit", type=int, default=None, help="Max rows to process")
    parser.add_argument(
        "--geocode-delay",
        type=float,
        default=0.2,
        help="Seconds to sleep between Mapbox calls (default 0.2)",
    )
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
    stats = run_loopnet_geom_backfill(
        client,
        dry_run=args.dry_run,
        page_size=args.page_size,
        limit=args.limit,
        geocode_delay=args.geocode_delay,
    )
    mode = "dry-run" if args.dry_run else "apply"
    print(
        f"Done ({mode}): "
        f"scanned={stats['scanned']}, "
        f"updated_from_coords={stats['updated_from_coords']}, "
        f"geocoded={stats['geocoded']}, "
        f"geocode_failed={stats['geocode_failed']}, "
        f"skipped_no_address={stats['skipped_no_address']}, "
        f"errors={stats['errors']}"
    )


if __name__ == "__main__":
    main()
