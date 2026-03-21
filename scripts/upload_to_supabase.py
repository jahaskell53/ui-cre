#!/usr/bin/env python3
# /// script
# dependencies = [
#   "supabase",
#   "python-dotenv",
# ]
# ///
"""
Reads the scraped LoopNet CSV, parses fields, geocodes addresses,
and upserts into the loopnet_listings Supabase table.

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

    rows = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Processing {len(rows)} listings from {csv_path}...")

    records = []
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

        records.append({
            'listing_url': row.get('url', '').strip(),
            'address': address,
            'headline': address,  # headline = address for this scraper
            'location': location,
            'price': row.get('price', '').strip(),
            'cap_rate': cap_rate,
            'building_category': building_cat,
            'square_footage': sq_ft,
            'latitude': lat,
            'longitude': lng,
        })

    print(f"\nUploading {len(records)} records to Supabase...")

    # Upsert in batches of 100
    batch_size = 100
    for start in range(0, len(records), batch_size):
        batch = records[start:start + batch_size]
        result = (
            client.table('loopnet_listings')
            .upsert(batch, on_conflict='listing_url')
            .execute()
        )
        print(f"  ✅ Upserted rows {start+1}–{min(start+batch_size, len(records))}")

    print("\nDone!")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 upload_to_supabase.py <path_to_csv>")
        sys.exit(1)
    main(sys.argv[1])
