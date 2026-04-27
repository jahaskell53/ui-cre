#!/bin/bash
# Injects one Crexi grid cell at a time into Chrome's DevTools console,
# waits for the download, then uploads to Supabase.
# Run from a terminal on this machine (requires display :1 and Chrome open on crexi.com).

set -e
export DISPLAY=:1
DOWNLOAD_DIR="/home/ubuntu/Downloads/Crexi/Comps & Records"
LOG="/home/ubuntu/crexi_grid.log"

CELLS=(
  "0 37.10795302 37.43725043 -122.68663062 -122.35108984"
  "1 37.10795302 37.43725043 -122.35108984 -122.01554906"
  "2 37.10795302 37.43725043 -122.01554906 -121.68000828"
  "3 37.43725043 37.76654785 -122.68663062 -122.35108984"
  "4 37.43725043 37.76654785 -122.35108984 -122.01554906"
  "5 37.43725043 37.76654785 -122.01554906 -121.68000828"
  "6 37.76654785 38.09584526 -122.68663062 -122.35108984"
  "7 37.76654785 38.09584526 -122.35108984 -122.01554906"
  "8 37.76654785 38.09584526 -122.01554906 -121.68000828"
)

inject_cell() {
  local CI=$1 LAT_MIN=$2 LAT_MAX=$3 LON_MIN=$4 LON_MAX=$5
  local JS="(async function(){const FILTERS={\"propertyAttributes.type\":{mode:\"Include\",structuredValues:[\"Multifamily\"],type:\"Plain\"},\"propertyAttributes.subType\":{mode:\"Include\",structuredValues:[\"Apartment Building\"],type:\"Plain\"}};const SIZE=500;const BBOX={latitudeMin:${LAT_MIN},latitudeMax:${LAT_MAX},longitudeMin:${LON_MIN},longitudeMax:${LON_MAX}};async function fp(from){const r=await fetch(\"https://api.crexi.com/universal-search/v2/search\",{method:\"POST\",headers:{\"content-type\":\"application/json\",\"schema-mode\":\"Searchable\",\"accept\":\"application/json, text/plain, */*\"},body:JSON.stringify({boundingBox:BBOX,filters:FILTERS,from,searchTypes:[\"Records\"],size:SIZE})});return r.json();}const first=await fp(0);const total=first.totalCount;console.log(\"CELL_${CI}_TOTAL:\",total);const all=[...(first.items||[])];for(let from=SIZE;from<total;from+=SIZE){const p=await fp(from);all.push(...(p.items||[]));await new Promise(r=>setTimeout(r,100));}console.log(\"CELL_${CI}_FETCHED:\",all.length);const blob=new Blob([JSON.stringify(all)],{type:\"application/json\"});const a=document.createElement(\"a\");a.href=URL.createObjectURL(blob);a.download=\"crexi_cell_${CI}.json\";document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);console.log(\"CELL_${CI}_DONE\");})();"

  printf '%s' "$JS" | xclip -selection clipboard
  sleep 0.2
  xdotool mousemove 1322 990; xdotool click 1
  sleep 0.3
  xdotool key ctrl+a; sleep 0.1; xdotool key ctrl+v
  sleep 0.3
  xdotool key Return
}

upload_cell() {
  local CI=$1
  python3 - "$CI" << 'PYEOF'
import json, os, sys, urllib.request, urllib.error

CI = sys.argv[1]
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TABLE = "crexi_api_comps"
DOWNLOAD_DIR = "/home/ubuntu/Downloads/Crexi/Comps & Records"
BATCH = 500

def flatten(r):
    addr = r.get("address") or [{}]
    addr = addr[0] if isinstance(addr, list) and addr else (addr if isinstance(addr, dict) else {})
    loc = addr.get("location") or {}
    attrs = r.get("propertyAttributes") or {}
    rt = r.get("recordType") or {}
    st = r.get("saleTransaction") or {}
    la = r.get("listingAttributes") or {}
    pp = r.get("propertyPrice") or {}
    if not isinstance(pp, dict):
        pp = {}
    return {
        "crexi_id": r.get("id") or r.get("propertyRecordId"),
        "property_name": r.get("propertyName"),
        "document_type": r.get("documentType"),
        "address_full": (addr.get("fullAddress") or ""),
        "address_street": addr.get("streetAddress"),
        "city": addr.get("city"),
        "state": addr.get("stateCode"),
        "zip": addr.get("zip"),
        "county": addr.get("county"),
        "latitude": loc.get("lat"),
        "longitude": loc.get("lon"),
        "property_type": attrs.get("type"),
        "property_subtype": attrs.get("subType"),
        "building_sqft": attrs.get("buildingSqft"),
        "num_units": attrs.get("unitsCount"),
        "address_count": attrs.get("addressCount"),
        "is_sales_comp": rt.get("isSalesComp"),
        "is_public_sales_comp": rt.get("isPublicSalesComp"),
        "is_broker_reported_sales_comp": rt.get("isBrokerReportedSalesComp"),
        "is_lease_comp": rt.get("isLeaseComp"),
        "sale_type": st.get("type"),
        "property_price_total": pp.get("total"),
        "property_price_per_sqft": pp.get("perSqft"),
        "property_price_per_acre": pp.get("perAcre"),
        "sale_transaction_date": st.get("date"),
        "days_on_market": st.get("daysOnMarket"),
        "date_activated": la.get("dateActivated"),
        "date_updated": la.get("dateUpdated"),
        "description": r.get("description"),
        "raw_json": r,
    }

with open(f"{DOWNLOAD_DIR}/crexi_cell_{CI}.json") as f:
    data = json.load(f)

rows = [flatten(r) for r in data]
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        data=json.dumps(batch).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as _: pass
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if '"23505"' not in body:
            print(f"Error: {body[:200]}", file=sys.stderr)

print(f"Cell {CI}: uploaded {len(rows)} rows")
PYEOF
}

echo "=== Crexi Grid Scrape ===" | tee -a "$LOG"
CHROME_WID=$(xdotool search --name "Google Chrome" | head -1)
xdotool windowactivate --sync $CHROME_WID

for CELL in "${CELLS[@]}"; do
  read -r CI LAT_MIN LAT_MAX LON_MIN LON_MAX <<< "$CELL"
  FILE="$DOWNLOAD_DIR/crexi_cell_${CI}.json"

  if [ -f "$FILE" ] && [ -s "$FILE" ]; then
    echo "Cell $CI: already downloaded, uploading..." | tee -a "$LOG"
  else
    echo "Cell $CI: injecting JS..." | tee -a "$LOG"
    inject_cell "$CI" "$LAT_MIN" "$LAT_MAX" "$LON_MIN" "$LON_MAX"

    echo "Cell $CI: waiting for download..." | tee -a "$LOG"
    WAITED=0
    while [ ! -f "$FILE" ] || [ ! -s "$FILE" ]; do
      sleep 5
      WAITED=$((WAITED + 5))
      if [ $WAITED -ge 600 ]; then
        echo "Cell $CI: TIMEOUT after 10min, skipping" | tee -a "$LOG"
        continue 2
      fi
    done
    sleep 2  # ensure write is complete
    echo "Cell $CI: downloaded ($(wc -c < "$FILE") bytes)" | tee -a "$LOG"
  fi

  upload_cell "$CI" | tee -a "$LOG"
  sleep 3
done

echo "=== All done ===" | tee -a "$LOG"
