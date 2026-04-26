# Crexi API Scraper

Scrapes Bay Area Multifamily/Apartment Building comps & records from the Crexi search API and loads them into the `crexi_api_comps` Supabase table.

## Why this approach

The Crexi website limits CSV exports to 10,000 rows. The underlying search API (`https://api.crexi.com/universal-search/v2/search`) returns up to 100k rows per geographic bounding box but requires a live authenticated browser session (Cloudflare blocks direct HTTP requests). This scraper runs JS inside Chrome on the VM to piggyback on the existing session.

## How it works

1. The Bay Area bounding box is split into a 3×3 grid of 9 cells, each with < 70k records.
2. For each cell, a JS snippet is injected into Chrome's DevTools console.
3. The JS paginates through the cell's results (500 per request), collects all items, and triggers a JSON download.
4. A Python script detects each downloaded file and uploads it to Supabase.

## Setup (one-time)

- Chrome must be open and logged in to [crexi.com](https://www.crexi.com). The scraper uses Chrome's existing session/cookies to authenticate with the Crexi API.
- Chrome must be running on display `:1` (it is by default in the Cloud Agent VM).
- `xclip` must be installed: `sudo apt-get install -y xclip` (pre-installed in the VM).
- Python 3 with access to `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.

## Running the scraper

### 1. Navigate Chrome to the Crexi Comps & Records search page

Open the browser and go to:

```
https://www.crexi.com/search?page=1&pageSize=500&recordType=sale&subtypes%5B%5D=Apartment%20Building&types%5B%5D=Multifamily&mapZoom=10&mapCenter=37.65161232826625,-122.20535429816395
```

Make sure you're logged in (property listings should appear).

### 2. Open DevTools Console

Press **F12** to open Chrome DevTools, then click the **Console** tab.

> **Note:** Do not click elsewhere in the page after pressing F12, or the DevTools may close. If DevTools closes, press F12 again while the page is focused.

### 3. Run the orchestrator script

Open a terminal and run:

```bash
bash /home/ubuntu/run_crexi_cells.sh
```

This script:
- Injects JS for each cell into the Chrome console (using `xdotool` + `xclip`)
- Waits up to 10 minutes per cell for the JSON file to download to `/home/ubuntu/Downloads/Crexi/Comps & Records/`
- Uploads each file to the `crexi_api_comps` Supabase table automatically
- Skips cells whose JSON file already exists (safe to re-run)

Progress is logged to `/home/ubuntu/crexi_grid.log`.

### 4. Grant download permission (first run only)

On the first run, Chrome will show a popup:

> **"www.crexi.com wants to Download multiple files"**

Click **Allow**. This only appears once per browser session.

### 5. Monitor progress

```bash
tail -f /home/ubuntu/crexi_grid.log
```

Each cell logs lines like:
```
Cell 3: injecting JS...
Cell 3: waiting for download...
Cell 3: downloaded (83000000 bytes)
Cell 3: uploaded 53440 rows
```

Total time: ~10–15 minutes for all 9 cells (~302k records).

## Verifying the data

Check the row count in Supabase:

```bash
python3 - << 'EOF'
import urllib.request, os
url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
req = urllib.request.Request(
    f"{url}/rest/v1/crexi_api_comps?select=id&limit=1",
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact"},
)
with urllib.request.urlopen(req) as r:
    print("Row count:", r.headers.get("content-range"))
EOF
```

Expected: ~302,000 rows (may be slightly less due to duplicate detection across grid cell boundaries).

## Re-running / refreshing data

To scrape fresh data (e.g. after a month):

1. Delete the existing cell files:
   ```bash
   rm "/home/ubuntu/Downloads/Crexi/Comps & Records/crexi_cell_"*.json
   ```
2. Truncate the table in Supabase (via dashboard SQL editor):
   ```sql
   TRUNCATE TABLE crexi_api_comps;
   ```
3. Re-run the script as above.

## Grid cell coordinates

The Bay Area bounding box (`37.108°N–38.096°N`, `122.687°W–121.680°W`) is split into a 3×3 grid:

| Cell | Lat range | Lon range | ~Records |
|------|-----------|-----------|----------|
| 0 | 37.108–37.437 | 122.687–122.351 | 5 |
| 1 | 37.108–37.437 | 122.351–122.016 | 15,642 |
| 2 | 37.108–37.437 | 122.016–121.680 | 29,491 |
| 3 | 37.437–37.667 | 122.687–122.351 | 53,440 |
| 4 | 37.437–37.667 | 122.351–122.016 | 67,745 |
| 5 | 37.437–37.667 | 122.016–121.680 | 13,723 |
| 6 | 37.667–38.096 | 122.687–122.351 | 47,717 |
| 7 | 37.667–38.096 | 122.351–122.016 | 64,140 |
| 8 | 37.667–38.096 | 122.016–121.680 | 10,080 |

## Table schema

`crexi_api_comps` columns:

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigserial | Auto PK |
| `crexi_id` | text | Unique Crexi record ID (e.g. `SALES~2435663`) |
| `property_name` | text | |
| `document_type` | text | Always `Records` |
| `address_full` | text | |
| `address_street` | text | |
| `city` | text | |
| `state` | text | |
| `zip` | text | |
| `county` | text | |
| `latitude` | double precision | |
| `longitude` | double precision | |
| `property_type` | text | e.g. `Multifamily` |
| `property_subtype` | text | e.g. `Apartment Building` |
| `building_sqft` | integer | |
| `num_units` | integer | |
| `address_count` | integer | |
| `is_sales_comp` | boolean | |
| `is_public_sales_comp` | boolean | |
| `is_broker_reported_sales_comp` | boolean | |
| `is_lease_comp` | boolean | |
| `sale_type` | text | e.g. `SingleProperty` |
| `days_on_market` | integer | |
| `date_activated` | text | ISO datetime |
| `date_updated` | text | ISO datetime |
| `description` | text | |
| `raw_json` | jsonb | Full API response item |
| `scraped_at` | timestamptz | Set on insert |
