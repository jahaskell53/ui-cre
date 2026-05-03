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
LOG_PATH = os.path.expanduser("~/crexi_detail_enrich.log")

DETAIL_WORKERS = 20       # parallel Crexi API calls
SUPABASE_BATCH = 200      # rows per Supabase upsert
FETCH_PAGE = 1000         # crexi_ids fetched from Supabase per page
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


def upsert_batch(rows: list[dict]) -> int:
    """Upsert a batch of rows to Supabase. Returns number of rows accepted."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        data=json.dumps(rows).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            with urllib.request.urlopen(req, timeout=60) as _:
                return len(rows)
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            log(f"  Supabase upsert error (attempt {attempt+1}): {body[:300]}")
            if attempt < len(RETRY_DELAYS):
                continue
    return 0


def main() -> None:
    import urllib.parse  # noqa: F401 — needed in fetch_detail

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
    total_upserted = 0
    pending_rows: list[dict] = []
    start_time = time.time()

    def flush_pending():
        nonlocal total_upserted, pending_rows
        if not pending_rows:
            return
        for i in range(0, len(pending_rows), SUPABASE_BATCH):
            total_upserted += upsert_batch(pending_rows[i : i + SUPABASE_BATCH])
        pending_rows = []

    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS) as pool:
        futures = {pool.submit(fetch_detail, cid): cid for cid in all_ids}
        done_count = 0
        for fut in as_completed(futures):
            result = fut.result()
            done_count += 1

            if "error" in result:
                total_err += 1
            else:
                total_ok += 1
                data = result.get("data")  # may be None for 404
                num_units = data.get("numberOfUnits") if data else None
                pending_rows.append({
                    "crexi_id": result["id"],
                    "detail_json": data,
                    "num_units": num_units,
                    "detail_enriched_at": now_iso,
                })

            # Flush to Supabase every SUPABASE_BATCH rows
            if len(pending_rows) >= SUPABASE_BATCH:
                flush_pending()

            # Log progress every 5000 records
            if done_count % 5000 == 0:
                elapsed = time.time() - start_time
                rate = done_count / elapsed
                eta = (len(all_ids) - done_count) / rate if rate else 0
                log(
                    f"Progress: {done_count}/{len(all_ids)} "
                    f"({100*done_count/len(all_ids):.1f}%) | "
                    f"{rate:.0f} req/s | ETA {eta/60:.1f}min | "
                    f"ok={total_ok} err={total_err} upserted={total_upserted}"
                )

    flush_pending()

    elapsed = time.time() - start_time
    log(f"=== Done in {elapsed/60:.1f}min: ok={total_ok} err={total_err} upserted={total_upserted} ===")

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
