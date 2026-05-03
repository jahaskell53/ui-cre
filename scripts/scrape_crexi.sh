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

def parse_gross_rent_annual(lease_rate_range):
    """Parse lower bound of leaseRateRange.totalAnnual (e.g. '$48,600' or '$20,400 - $24,000') as float."""
    if not isinstance(lease_rate_range, dict):
        return None
    raw = lease_rate_range.get("totalAnnual")
    if not raw:
        return None
    import re
    lower = raw.split(" - ")[0]
    cleaned = re.sub(r'[$,\s]', '', lower)
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None

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
    fin = r.get("financials") or {}
    lot = r.get("lotAttributes") or {}
    occ = r.get("occupancyDetails") or {}
    own = r.get("ownership") or {}
    mf = r.get("mortgageFinancials") or {}
    cy = r.get("constructionYear") or {}
    src = r.get("source") or {}
    inv = r.get("investmentType") or {}
    tax = r.get("tax") or {}
    lrr = r.get("leaseRateRange") or {}
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
        "apn": addr.get("apn"),
        "latitude": loc.get("lat"),
        "longitude": loc.get("lon"),
        "property_type": attrs.get("type"),
        "property_subtype": attrs.get("subType"),
        "building_sqft": attrs.get("buildingSqft"),
        "num_units": attrs.get("unitsCount"),
        "address_count": attrs.get("addressCount"),
        "stories_count": attrs.get("storiesCount"),
        "construction_type": attrs.get("constructionType"),
        "class_type": attrs.get("classType"),
        "buildings_count": attrs.get("buildingsCount"),
        "footprint_sqft": attrs.get("footprintSqft"),
        "is_sales_comp": rt.get("isSalesComp"),
        "is_public_sales_comp": rt.get("isPublicSalesComp"),
        "is_broker_reported_sales_comp": rt.get("isBrokerReportedSalesComp"),
        "is_lease_comp": rt.get("isLeaseComp"),
        "sale_type": st.get("type"),
        "sale_cap_rate_percent": st.get("capRatePercent"),
        "sale_buyer": st.get("buyer"),
        "sale_seller": st.get("seller"),
        "property_price_total": pp.get("total"),
        "property_price_per_sqft": pp.get("perSqft"),
        "property_price_per_acre": pp.get("perAcre"),
        "sale_transaction_date": st.get("date"),
        "days_on_market": st.get("daysOnMarket"),
        "date_activated": la.get("dateActivated"),
        "date_updated": la.get("dateUpdated"),
        "description": r.get("description"),
        "financials_cap_rate_percent": fin.get("capRatePercent"),
        "financials_noi": fin.get("netOperatingIncome"),
        "lot_size_sqft": lot.get("sizeSqft"),
        "lot_size_acre": lot.get("sizeAcre"),
        "zoning": lot.get("zoning"),
        "is_opportunity_zone": lot.get("isOpportunityZone"),
        "occupancy_rate_percent": occ.get("occupancyRatePercent"),
        "year_built": cy.get("built"),
        "owner_name": own.get("ownerName"),
        "is_corporate_owner": own.get("isCorporateOwner"),
        "is_crexi_source": src.get("isCrexi"),
        "investment_type": inv.get("name") if isinstance(inv, dict) else None,
        "lender": mf.get("lender"),
        "loan_amount": mf.get("loanAmount"),
        "loan_type": mf.get("loanType"),
        "interest_rate": mf.get("interestRate"),
        "mortgage_maturity_date": mf.get("maturityDate"),
        "mortgage_recording_date": mf.get("recordingDate"),
        "loan_term": mf.get("loanTerm"),
        "title_company": mf.get("titleCompany"),
        "tax_amount": tax.get("amount"),
        "tax_parcel_value": tax.get("parcelValue"),
        "tax_land_value": tax.get("landValue"),
        "tax_improvement_value": tax.get("improvementValue"),
        "gross_rent_annual": parse_gross_rent_annual(lrr),
        # Per-unit condo/apartment sales carry a building-level `unitsCount`
        # (num_units) while property_price_total is a single-unit price, which
        # breaks price-per-door math. Exclude these from Crexi sales trends.
        "exclude_from_sales_trends": addr.get("unitNumber") is not None,
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
