#!/usr/bin/env python3
"""
Enrich crexi_api_comps.detail_json (and num_units) from the Crexi property
detail API: GET https://api.crexi.com/properties/{crexi_id}

The detail API is the authoritative source for unit counts and building details.
It is directly accessible without a browser session.

Usage:
    python3 scripts/enrich_crexi_units.py

Environment variables required:
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

Progress is logged to ~/crexi_detail_enrich.log and stdout.
Safe to re-run: skips rows already enriched (detail_enriched_at IS NOT NULL)
unless --force is passed.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TABLE = "crexi_api_comps"
LOG_PATH = "/tmp/crexi_detail_enrich.log"

DETAIL_WORKERS = 100      # parallel Crexi API calls
SUPABASE_BATCH = 50       # parallel Supabase PATCH workers per chunk
FETCH_PAGE = 1000         # crexi_ids fetched from Supabase per page
CHUNK_SIZE = 5000         # process IDs in chunks to bound memory usage
RETRY_DELAYS = [2, 5, 10] # retry backoff for transient errors

FORCE = "--force" in sys.argv  # re-enrich rows that already have detail_enriched_at

HEADERS_DETAIL = {
    "accept": "application/json, text/plain, */*",
    "x-xt-universal-pdp": "true",
    "user-agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "origin": "https://www.crexi.com",
    "referer": "https://www.crexi.com/",
}


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def fetch_all_crexi_ids() -> list[str]:
    """Fetch all crexi_ids from Supabase using cursor-based pagination on id."""
    ids: list[str] = []
    last_id = 0
    filter_clause = "" if FORCE else "&detail_enriched_at=is.null"
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/{TABLE}"
            f"?select=id,crexi_id&order=id.asc&limit={FETCH_PAGE}&id=gt.{last_id}{filter_clause}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Accept": "application/json",
            },
        )
        for attempt, delay in enumerate([0] + RETRY_DELAYS):
            if delay:
                time.sleep(delay)
            try:
                with urllib.request.urlopen(req) as r:
                    page = json.loads(r.read())
                break
            except urllib.error.HTTPError as e:
                if attempt < len(RETRY_DELAYS):
                    log(f"  ID fetch error at id>{last_id}, retry {attempt+1}...")
                    continue
                raise
        if not page:
            break
        ids.extend(row["crexi_id"] for row in page if row.get("crexi_id"))
        last_id = page[-1]["id"]
        if len(ids) % 10000 == 0 and len(ids) > 0:
            log(f"  Fetched {len(ids)} IDs so far (last id={last_id})...")
        if len(page) < FETCH_PAGE:
            break
    return ids


def fetch_detail(crexi_id: str) -> dict:
    """Call GET /properties/{id}. Returns {'id': ..., 'data': ...} or {'id': ..., 'error': ...}."""
    url = f"https://api.crexi.com/properties/{urllib.parse.quote(crexi_id, safe='')}"
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            req = urllib.request.Request(url, headers=HEADERS_DETAIL)
            with urllib.request.urlopen(req, timeout=20) as r:
                return {"id": crexi_id, "data": json.loads(r.read())}
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                # Property deleted/gone on Crexi — store null detail_json
                return {"id": crexi_id, "data": None, "http_status": e.code}
            if attempt < len(RETRY_DELAYS):
                continue
            return {"id": crexi_id, "error": f"HTTP {e.code}"}
        except Exception as exc:
            if attempt < len(RETRY_DELAYS):
                continue
            return {"id": crexi_id, "error": str(exc)[:120]}
    return {"id": crexi_id, "error": "max retries"}


def patch_row(row: dict) -> bool:
    """PATCH a single row by crexi_id. Returns True on success."""
    crexi_id = row["crexi_id"]
    payload = {
        "detail_json": row["detail_json"],
        "num_units": row["num_units"],
        "detail_enriched_at": row["detail_enriched_at"],
    }
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?crexi_id=eq.{urllib.parse.quote(crexi_id, safe='')}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            with urllib.request.urlopen(req, timeout=30) as _:
                return True
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            body = e.read().decode() if hasattr(e, "read") else str(e)
            if attempt < len(RETRY_DELAYS):
                continue
            log(f"  PATCH error for {crexi_id}: {body[:200]}")
    return False


CHUNK_SIZE = 5000  # moved to top-level constants


def main() -> None:
    import urllib.parse  # noqa: F401 — needed in fetch_detail and patch_row

    log("=== Crexi detail enrichment started ===")
    log(f"Mode: {'force re-enrich all' if FORCE else 'skip already-enriched rows'}")

    log("Fetching crexi_ids from Supabase...")
    all_ids = fetch_all_crexi_ids()
    log(f"Total IDs to enrich: {len(all_ids)}")
    if not all_ids:
        log("Nothing to do.")
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    total_ok = 0
    total_err = 0
    total_patched = 0
    start_time = time.time()

    # Process in chunks of CHUNK_SIZE to keep memory bounded.
    for chunk_start in range(0, len(all_ids), CHUNK_SIZE):
        chunk = all_ids[chunk_start : chunk_start + CHUNK_SIZE]

        # Fetch detail for this chunk in parallel
        rows_to_patch: list[dict] = []
        with ThreadPoolExecutor(max_workers=DETAIL_WORKERS) as detail_pool:
            futures = {detail_pool.submit(fetch_detail, cid): cid for cid in chunk}
            for fut in as_completed(futures):
                result = fut.result()
                if "error" in result:
                    total_err += 1
                else:
                    total_ok += 1
                    data = result.get("data")
                    num_units = data.get("numberOfUnits") if data else None
                    rows_to_patch.append({
                        "crexi_id": result["id"],
                        "detail_json": data,
                        "num_units": num_units,
                        "detail_enriched_at": now_iso,
                    })

        # PATCH this chunk to Supabase in parallel
        with ThreadPoolExecutor(max_workers=SUPABASE_BATCH) as patch_pool:
            patch_results = list(patch_pool.map(patch_row, rows_to_patch))
        total_patched += sum(1 for r in patch_results if r)

        done_count = chunk_start + len(chunk)
        elapsed = time.time() - start_time
        rate = done_count / elapsed if elapsed else 0
        eta = (len(all_ids) - done_count) / rate if rate else 0
        log(
            f"Progress: {done_count}/{len(all_ids)} "
            f"({100*done_count/len(all_ids):.1f}%) | "
            f"{rate:.0f} req/s | ETA {eta/60:.1f}min | "
            f"ok={total_ok} err={total_err} patched={total_patched}"
        )

    elapsed = time.time() - start_time
    log(f"=== Done in {elapsed/60:.1f}min: ok={total_ok} err={total_err} patched={total_patched} ===")

    # Spot-check
    log("Spot-check: 379 Coronado St, El Granada (crexi_id=3f61c9e4027ff14493630430d81f03e84e7c0f5b)...")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{TABLE}"
        "?crexi_id=eq.3f61c9e4027ff14493630430d81f03e84e7c0f5b"
        "&select=crexi_id,num_units,detail_enriched_at,detail_json",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req) as r:
        rows = json.loads(r.read())
    for row in rows:
        dj = row.get("detail_json") or {}
        log(f"  num_units={row['num_units']}  (was 9, expect 5)")
        log(f"  detail_enriched_at={row['detail_enriched_at']}")
        log(f"  detail_json.numberOfUnits={dj.get('numberOfUnits')}")
        log(f"  detail_json.description={dj.get('description')}")


if __name__ == "__main__":
    import urllib.parse
    main()
