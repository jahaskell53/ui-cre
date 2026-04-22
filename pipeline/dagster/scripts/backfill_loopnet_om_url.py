#!/usr/bin/env python3
"""
Recompute loopnet_listing_details.om_url from existing attachment_urls using the same
rules as download_om_pdfs (see zillow_pipeline.lib.loopnet_om_selection).

Usage (from repo root or pipeline/dagster):
  cd pipeline/dagster && .venv/bin/python scripts/backfill_loopnet_om_url.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env).

To run from Dagster+: deploy and launch job **backfill_loopnet_om_url_job**.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

_SCRIPT_DIR = Path(__file__).resolve().parent
_DAGSTER_ROOT = _SCRIPT_DIR.parent
if str(_DAGSTER_ROOT) not in sys.path:
    sys.path.insert(0, str(_DAGSTER_ROOT))

from zillow_pipeline.lib.loopnet_om_backfill import run_backfill


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
    stats = run_backfill(client)
    print(
        f"Done: updated={stats['updated']}, unchanged={stats['unchanged']}, "
        f"skipped_no_attachment_urls={stats['skipped_no_attachment_urls']}, errors={stats['errors']}"
    )


if __name__ == "__main__":
    main()
