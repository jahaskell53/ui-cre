"""Geocode loopnet_listing_details rows that are missing a geom column value.

Strategy
--------
* Rows with latitude/longitude already set are updated first (no Mapbox call needed).
* Rows where both lat/lng and geom are NULL are geocoded via the Mapbox
  Geocoding API using address_raw (falling back to address + location).
* The Mapbox token is read from the MAPBOX_TOKEN environment variable.
"""

from __future__ import annotations

import os
import time
import urllib.parse
import urllib.request
import json
import logging

from supabase import Client

logger = logging.getLogger(__name__)

MAPBOX_TOKEN = os.environ.get(
    "MAPBOX_TOKEN",
    "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA",
)

_MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={token}&limit=1&types=address"


def _geocode(address: str) -> tuple[float, float] | tuple[None, None]:
    """Return (lat, lng) from Mapbox for *address*, or (None, None) on failure."""
    if not address or not address.strip():
        return None, None
    try:
        encoded = urllib.parse.quote(address.strip())
        url = _MAPBOX_URL.format(query=encoded, token=MAPBOX_TOKEN)
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        features = data.get("features") or []
        if features:
            lng, lat = features[0]["center"]
            return float(lat), float(lng)
    except Exception as exc:
        logger.warning("Geocoding failed for %r: %s", address, exc)
    return None, None


def _geom_wkt(lng: float, lat: float) -> str:
    return f"POINT({lng} {lat})"


def run_loopnet_geom_backfill(
    client: Client,
    *,
    run_id: int | None = None,
    dry_run: bool = False,
    page_size: int = 200,
    limit: int | None = None,
    geocode_delay: float = 0.2,
) -> dict[str, int]:
    """Populate geom on loopnet_listings rows where it is NULL.

    Two passes:
    1. Rows that already have latitude/longitude — update geom from those values
       (no Mapbox call).
    2. Rows where lat/lng are also NULL — geocode via Mapbox using address_raw
       (or address + location as fallback), then update both lat/lng and geom.

    Returns counts: scanned, updated_from_coords, geocoded, geocode_failed,
    skipped_no_address, errors.
    """
    page_size = max(1, page_size)
    stats: dict[str, int] = {
        "scanned": 0,
        "updated_from_coords": 0,
        "geocoded": 0,
        "geocode_failed": 0,
        "skipped_no_address": 0,
        "errors": 0,
    }

    # ── Pass 1: rows with lat/lng but no geom ──────────────────────────────
    offset = 0
    while True:
        q = (
            client.table("loopnet_listing_details")
            .select("id,latitude,longitude")
            .is_("geom", "null")
            .not_.is_("latitude", "null")
            .not_.is_("longitude", "null")
            .order("id")
        )
        rows = (q.range(offset, offset + page_size - 1).execute()).data or []
        if not rows:
            break

        for row in rows:
            if limit is not None and stats["scanned"] >= limit:
                break
            stats["scanned"] += 1
            rid = row["id"]
            try:
                lat = float(row["latitude"])
                lng = float(row["longitude"])
            except (TypeError, ValueError):
                stats["errors"] += 1
                continue

            if not dry_run:
                try:
                    client.table("loopnet_listing_details").update(
                        {"geom": _geom_wkt(lng, lat)}
                    ).eq("id", rid).execute()
                except Exception as exc:
                    logger.error("Pass-1 update failed for id=%s: %s", rid, exc)
                    stats["errors"] += 1
                    continue
            stats["updated_from_coords"] += 1

        if limit is not None and stats["scanned"] >= limit:
            break
        if len(rows) < page_size:
            break
        offset += page_size

    # ── Pass 2: rows with no lat/lng and no geom — geocode ────────────────
    offset = 0
    while True:
        if limit is not None and stats["scanned"] >= limit:
            break

        q = (
            client.table("loopnet_listing_details")
            .select("id,address_raw,address,location")
            .is_("geom", "null")
            .is_("latitude", "null")
            .order("id")
        )
        rows = (q.range(offset, offset + page_size - 1).execute()).data or []
        if not rows:
            break

        for row in rows:
            if limit is not None and stats["scanned"] >= limit:
                break
            stats["scanned"] += 1
            rid = row["id"]

            # Build address string for geocoding
            addr_raw = (row.get("address_raw") or "").strip()
            if not addr_raw:
                street = (row.get("address") or "").strip()
                loc = (row.get("location") or "").strip()
                addr_raw = ", ".join(p for p in (street, loc) if p)

            if not addr_raw:
                stats["skipped_no_address"] += 1
                continue

            lat, lng = _geocode(addr_raw)
            time.sleep(geocode_delay)

            if lat is None or lng is None:
                stats["geocode_failed"] += 1
                continue

            if not dry_run:
                try:
                    client.table("loopnet_listing_details").update(
                        {
                            "latitude": lat,
                            "longitude": lng,
                            "geom": _geom_wkt(lng, lat),
                        }
                    ).eq("id", rid).execute()
                except Exception as exc:
                    logger.error("Pass-2 update failed for id=%s: %s", rid, exc)
                    stats["errors"] += 1
                    continue
            stats["geocoded"] += 1

        if limit is not None and stats["scanned"] >= limit:
            break
        if len(rows) < page_size:
            break
        offset += page_size

    return stats
