#!/usr/bin/env python3
# /// script
# dependencies = [
#   "supabase",
#   "python-dotenv",
# ]
# ///
"""
Reads the scraped LoopNet CSV, parses fields, geocodes addresses,
and upserts into loopnet_listing_details and loopnet_listing_snapshots.

Usage:
    uv run upload_to_supabase.py <path_to_csv>

Environment variables (loaded from .env in same directory):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    MAPBOX_TOKEN  (optional, falls back to hardcoded token)
"""

import csv
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import json
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Load .env from the same directory as this script
load_dotenv(Path(__file__).parent / '.env')

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA")

CAP_RATE_RE = re.compile(r'(\d+\.?\d*%\s*Cap\s*Rate)', re.IGNORECASE)
SF_RE = re.compile(r'([\d,]+\s*SF)', re.IGNORECASE)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def parse_detail1(val):
    """Extract cap rate from detail1; return (cap_rate, remainder)."""
    m = CAP_RATE_RE.search(val)
    if m:
        return m.group(1), CAP_RATE_RE.sub('', val).strip(', ')
    return '', val.strip()


def parse_detail2(val):
    """Extract square footage and building category from detail2."""
    sf_match = SF_RE.search(val)
    sq_ft = sf_match.group(1).strip() if sf_match else ''
    building_cat = SF_RE.sub('', val).strip(', ').strip()
    return sq_ft, building_cat


def geocode(address):
    """Return (lat, lng) or (None, None)."""
    try:
        encoded = urllib.parse.quote(address)
        url = (
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json"
            f"?access_token={MAPBOX_TOKEN}"
        )
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())
            if data.get('features'):
                lng, lat = data['features'][0]['center']
                return lat, lng
    except Exception as e:
        print(f"  ⚠️  Geocoding failed for '{address}': {e}")
    return None, None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main(csv_path):
    if not os.path.exists(csv_path):
        print(f"Error: file not found: {csv_path}")
        sys.exit(1)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get next sequential run_id from snapshots table
    result = client.table('loopnet_listing_snapshots').select('run_id').order('run_id', desc=True).limit(1).execute()
    last_run_id = result.data[0]['run_id'] if result.data and result.data[0]['run_id'] else 0
    run_id = last_run_id + 1
    print(f"Run ID: {run_id}")

    rows = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Processing {len(rows)} listings from {csv_path}...")

    detail_records = []
    snapshot_records = []
    for i, row in enumerate(rows):
        detail1 = row.get('detail1', '').strip()
        detail2 = row.get('detail2', '').strip()

        cap_rate, extra_from_d1 = parse_detail1(detail1)
        sq_ft, building_cat = parse_detail2(detail2)

        # If detail1 wasn't a cap rate, it may contain building category info
        if not cap_rate and extra_from_d1 and not building_cat:
            building_cat = extra_from_d1

        address = row.get('address', '').strip()
        location = row.get('location', '').strip()
        full_address = f"{address}, {location}".strip(', ')

        print(f"[{i+1}/{len(rows)}] Geocoding: {full_address}")
        lat, lng = geocode(full_address)
        time.sleep(0.2)  # respect rate limits

        def to_int(val):
            """Convert a string like '8' or '4' to int, or None."""
            try:
                return int(str(val).strip().replace(',', '')) if val else None
            except (ValueError, TypeError):
                return None

        listing_url = row.get('url', '').strip()
        price = row.get('price', '').strip()
        price_per_unit = row.get('price_per_unit', '').strip() or None
        grm = row.get('grm', '').strip() or None

        detail_records.append({
            'listing_url':      listing_url,
            'address':          address,
            'headline':         address,
            'location':         location,
            'building_category': building_cat,
            'square_footage':   sq_ft,
            'latitude':         lat,
            'longitude':        lng,
            'description':      row.get('description', '').strip() or None,
            'date_on_market':   row.get('date_modified', '').strip() or None,
            'price_per_unit':   price_per_unit,
            'grm':              grm,
            'num_units':        to_int(row.get('num_units')),
            'property_subtype': row.get('property_subtype', '').strip() or None,
            'apartment_style':  row.get('apartment_style', '').strip() or None,
            'building_class':   row.get('building_class', '').strip() or None,
            'lot_size':         row.get('lot_size', '').strip() or None,
            'building_size':    row.get('building_size', '').strip() or None,
            'num_stories':      to_int(row.get('num_stories')),
            'year_built':       to_int(row.get('year_built')),
            'zoning':           row.get('zoning', '').strip() or None,
        })

        snapshot_records.append({
            'listing_url':   listing_url,
            'run_id':        run_id,
            'price':         price or None,
            'price_per_unit': price_per_unit,
            'cap_rate':      cap_rate or None,
            'grm':           grm,
        })

    print(f"\nUploading {len(detail_records)} records to Supabase...")

    batch_size = 100

    # Upsert details (one row per listing_url)
    for start in range(0, len(detail_records), batch_size):
        batch = detail_records[start:start + batch_size]
        client.table('loopnet_listing_details').upsert(batch, on_conflict='listing_url').execute()
        print(f"  ✅ Upserted details rows {start+1}–{min(start+batch_size, len(detail_records))}")

    # Insert snapshots (one row per listing_url + run_id)
    for start in range(0, len(snapshot_records), batch_size):
        batch = snapshot_records[start:start + batch_size]
        client.table('loopnet_listing_snapshots').upsert(batch, on_conflict='listing_url,run_id').execute()
        print(f"  ✅ Upserted snapshot rows {start+1}–{min(start+batch_size, len(snapshot_records))}")

    print("\nDone!")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 upload_to_supabase.py <path_to_csv>")
        sys.exit(1)
    main(sys.argv[1])
