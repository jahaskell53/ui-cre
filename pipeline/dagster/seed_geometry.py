# /// script
# dependencies = [
#   "psycopg2-binary",
#   "python-dotenv",
# ]
# ///

"""
One-time script to backfill the geom column in zip_codes from the CSV.
Run with: uv run seed_geometry.py
Requires DATABASE_URL in .env (find it in Supabase: Settings > Database > Connection string > URI)
"""

import csv
import sys
import os
from dotenv import load_dotenv

load_dotenv()

csv.field_size_limit(sys.maxsize)

DATABASE_URL = os.environ["DATABASE_URL"]

import psycopg2

CSV_PATH = "bay-area-zip-codes.csv"

rows = []
with open(CSV_PATH) as f:
    reader = csv.DictReader(f)
    for row in reader:
        wkt = row["the_geom"].strip()
        zip_code = row["zip"].strip()
        rows.append((wkt, zip_code))

print(f"Loaded {len(rows)} rows from CSV")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

for i, (wkt, zip_code) in enumerate(rows):
    cur.execute(
        "UPDATE zip_codes SET geom = ST_GeomFromText(%s, 4326) WHERE zip = %s",
        (wkt, zip_code),
    )
    if (i + 1) % 50 == 0:
        print(f"  {i + 1}/{len(rows)} updated")

conn.commit()
cur.close()
conn.close()

print(f"Done. {len(rows)} zip codes updated with geometry.")
