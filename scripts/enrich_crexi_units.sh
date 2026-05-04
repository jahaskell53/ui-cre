#!/bin/bash
# Enriches crexi_api_comps.num_units (stores full detail payload in
# crexi_api_comp_detail_json.detail_json) by calling GET https://api.crexi.com/properties/{id}
# row in the table, using Chrome's existing authenticated session.
#
# Prerequisites:
#   - Chrome open and logged in to crexi.com on display :1
#   - DevTools console open (F12 → Console tab)
#   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
#   - xclip installed (sudo apt-get install -y xclip)
#
# Usage:
#   bash scripts/enrich_crexi_units.sh
#
# The script works in two phases:
#   Phase 1 (JS, injected into Chrome): fetches all crexi_ids from Supabase,
#     calls the Crexi detail API for each, downloads results as JSON batches.
#   Phase 2 (Python, run locally): reads the downloaded JSON, upserts
#     crexi_api_comp_detail_json + crexi_api_comps (num_units + detail_enriched_at).

set -e
export DISPLAY=:1

DOWNLOAD_DIR="/home/ubuntu/Downloads/Crexi/Detail"
LOG="/home/ubuntu/crexi_detail_enrich.log"
BATCH_SIZE=50        # parallel detail API calls per JS chunk
CHUNK_SIZE=5000      # IDs per downloaded JSON file

mkdir -p "$DOWNLOAD_DIR"

echo "=== Crexi Detail Enrichment ===" | tee -a "$LOG"
echo "Download dir: $DOWNLOAD_DIR" | tee -a "$LOG"

# ─── Phase 1: inject JS into Chrome ──────────────────────────────────────────
# The JS will:
#   1. Fetch all crexi_ids from Supabase (paginated, 1000 at a time)
#   2. Call GET /properties/{id} for each, BATCH_SIZE in parallel
#   3. Download results in chunks of CHUNK_SIZE as crexi_detail_N.json

inject_enrich_js() {
  local JS
  JS="(async function(){
const SUPABASE_URL='${NEXT_PUBLIC_SUPABASE_URL}';
const SUPABASE_KEY='${SUPABASE_SERVICE_ROLE_KEY}';
const BATCH=${BATCH_SIZE};
const CHUNK=${CHUNK_SIZE};
const DOWNLOAD_DIR_NOTE='${DOWNLOAD_DIR}';

// Fetch all crexi_ids from Supabase
async function fetchAllIds(){
  let ids=[];
  let offset=0;
  const pageSize=1000;
  while(true){
    const r=await fetch(SUPABASE_URL+'/rest/v1/crexi_api_comps?select=crexi_id&limit='+pageSize+'&offset='+offset,{
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Accept':'application/json'}
    });
    const page=await r.json();
    if(!page||!page.length)break;
    ids=ids.concat(page.map(x=>x.crexi_id).filter(Boolean));
    offset+=pageSize;
    if(page.length<pageSize)break;
  }
  return ids;
}

// Call detail API for one id
async function fetchDetail(id){
  try{
    const r=await fetch('https://api.crexi.com/properties/'+encodeURIComponent(id),{
      headers:{'accept':'application/json, text/plain, */*','x-xt-universal-pdp':'true'}
    });
    if(!r.ok)return{id,error:r.status};
    const data=await r.json();
    return{id,data};
  }catch(e){
    return{id,error:String(e)};
  }
}

// Download a JSON blob
function download(filename,obj){
  const blob=new Blob([JSON.stringify(obj)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
}

console.log('ENRICH: fetching all crexi_ids from Supabase...');
const allIds=await fetchAllIds();
console.log('ENRICH: total ids=',allIds.length);

let chunkIdx=0;
let results=[];
for(let i=0;i<allIds.length;i+=BATCH){
  const batchIds=allIds.slice(i,i+BATCH);
  const batchResults=await Promise.all(batchIds.map(fetchDetail));
  results=results.concat(batchResults);
  if(results.length>=CHUNK||(i+BATCH)>=allIds.length){
    const fname='crexi_detail_'+chunkIdx+'.json';
    console.log('ENRICH: downloading',fname,'('+results.length+' records, up to id idx '+(i+BATCH)+')');
    download(fname,results);
    await new Promise(r=>setTimeout(r,500));
    chunkIdx++;
    results=[];
  }
  // small delay every batch to avoid hammering the API
  if(i%500===0&&i>0)await new Promise(r=>setTimeout(r,200));
}
console.log('ENRICH: all chunks downloaded, total chunks=',chunkIdx);
})();"

  printf '%s' "$JS" | xclip -selection clipboard
  sleep 0.2
  CHROME_WID=$(xdotool search --name "Google Chrome" | head -1)
  xdotool windowactivate --sync "$CHROME_WID"
  xdotool mousemove 1322 990; xdotool click 1
  sleep 0.3
  xdotool key ctrl+a; sleep 0.1; xdotool key ctrl+v
  sleep 0.3
  xdotool key Return
  echo "JS injected. Monitor Chrome console for ENRICH: log lines." | tee -a "$LOG"
  echo "Files will download to ~/Downloads as crexi_detail_N.json" | tee -a "$LOG"
}

# ─── Phase 2: upload each detail chunk ───────────────────────────────────────
upload_chunk() {
  local CHUNK_FILE="$1"
  python3 - "$CHUNK_FILE" "$LOG" << 'PYEOF'
import json, os, sys, urllib.request, urllib.error
from datetime import datetime, timezone

CHUNK_FILE = sys.argv[1]
LOG = sys.argv[2]
RUN_ID = int(os.environ["CREXI_RUN_ID"])
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MAIN_TABLE = "crexi_api_comps"
DETAIL_TABLE = "crexi_api_comp_detail_json"
BATCH = 200

def log(msg):
    print(msg)
    with open(LOG, "a") as f:
        f.write(msg + "\n")

with open(CHUNK_FILE) as f:
    records = json.load(f)

now_iso = datetime.now(timezone.utc).isoformat()
rows = []
errors = 0
for rec in records:
    if "error" in rec:
        errors += 1
        continue
    data = rec.get("data") or {}
    num_units = data.get("numberOfUnits")
    rows.append({
        "crexi_id": rec["id"],
        "detail_json": data,
        "num_units": num_units,
        "detail_enriched_at": now_iso,
        "run_id": RUN_ID,
        # The browser-injected JS path doesn't surface HTTP status codes
        # explicitly, so http_status stays NULL here. The `enrich_crexi_units.py`
        # path captures it.
    })

log(f"  {CHUNK_FILE}: {len(rows)} ok, {errors} errors")

updated = 0
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    detail_batch = [
        {"crexi_id": r["crexi_id"], "detail_json": r["detail_json"], "run_id": r["run_id"]}
        for r in batch
    ]
    main_batch = [
        {"crexi_id": r["crexi_id"], "num_units": r["num_units"], "detail_enriched_at": r["detail_enriched_at"]}
        for r in batch
    ]
    try:
        for path, payload in (
            (DETAIL_TABLE, detail_batch),
            (MAIN_TABLE, main_batch),
        ):
            req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/{path}",
                data=json.dumps(payload).encode(),
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
                method="POST",
            )
            with urllib.request.urlopen(req) as _:
                pass
        updated += len(batch)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        log(f"  ERROR batch {i}: {body[:300]}")

log(f"  {CHUNK_FILE}: upserted {updated} rows")
PYEOF
}

start_run() {
  python3 - << 'PYEOF'
import json, os, urllib.request

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

scraper_version = os.environ.get("CREXI_SCRAPER_VERSION") or os.popen("git rev-parse --short HEAD 2>/dev/null").read().strip() or None
payload = [{
    "source": "detail",
    "scraper_version": scraper_version,
    "status": "running",
    "params": {"script": "scripts/enrich_crexi_units.sh"},
}]
req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/crexi_scrape_runs",
    data=json.dumps(payload).encode(),
    headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
    method="POST",
)
with urllib.request.urlopen(req) as r:
    print(json.loads(r.read())[0]["run_id"])
PYEOF
}

finish_run() {
  local RUN_ID=$1 STATUS=$2 ROW_COUNT=$3
  python3 - "$RUN_ID" "$STATUS" "$ROW_COUNT" << 'PYEOF'
import json, os, sys, urllib.request, datetime

RUN_ID, STATUS, ROW_COUNT = sys.argv[1], sys.argv[2], int(sys.argv[3])
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
payload = {
    "status": STATUS,
    "finished_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "row_count": ROW_COUNT,
}
req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/crexi_scrape_runs?run_id=eq.{RUN_ID}",
    data=json.dumps(payload).encode(),
    headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    },
    method="PATCH",
)
urllib.request.urlopen(req).read()
PYEOF
}

# ─── Main ─────────────────────────────────────────────────────────────────────
export CREXI_RUN_ID
CREXI_RUN_ID=$(start_run)
echo "crexi_scrape_runs run_id=$CREXI_RUN_ID" | tee -a "$LOG"
trap 'finish_run "$CREXI_RUN_ID" "failed" 0' ERR

echo "Step 1: injecting JS into Chrome..." | tee -a "$LOG"
inject_enrich_js

echo "" | tee -a "$LOG"
echo "Step 2: waiting for download files and uploading..." | tee -a "$LOG"
echo "(This may take 20-40 minutes for ~286k records)" | tee -a "$LOG"

CHUNK=0
TOTAL_CHUNKS_EXPECTED=$(python3 -c "
import urllib.request, os
req = urllib.request.Request(
    os.environ['NEXT_PUBLIC_SUPABASE_URL']+'/rest/v1/crexi_api_comps?select=id&limit=1',
    headers={'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
             'Authorization': 'Bearer '+os.environ['SUPABASE_SERVICE_ROLE_KEY'],
             'Prefer': 'count=exact'},
)
with urllib.request.urlopen(req) as r:
    cr = r.headers.get('content-range','0/0')
    total = int(cr.split('/')[-1])
    print((total + ${CHUNK_SIZE} - 1) // ${CHUNK_SIZE})
")
echo "Expecting ~$TOTAL_CHUNKS_EXPECTED chunk files." | tee -a "$LOG"

WAITED=0
while [ $CHUNK -lt "$TOTAL_CHUNKS_EXPECTED" ]; do
  FILE="$DOWNLOAD_DIR/crexi_detail_${CHUNK}.json"
  if [ -f "$FILE" ] && [ -s "$FILE" ]; then
    echo "Chunk $CHUNK: found, uploading..." | tee -a "$LOG"
    upload_chunk "$FILE"
    CHUNK=$((CHUNK + 1))
    WAITED=0
  else
    sleep 10
    WAITED=$((WAITED + 10))
    if [ $WAITED -ge 1800 ]; then
      echo "Chunk $CHUNK: TIMEOUT after 30min, stopping." | tee -a "$LOG"
      break
    fi
    # print progress every 60s
    if [ $((WAITED % 60)) -eq 0 ]; then
      echo "  Still waiting for chunk $CHUNK (${WAITED}s elapsed)..." | tee -a "$LOG"
    fi
  fi
done

trap - ERR
finish_run "$CREXI_RUN_ID" "completed" 0
echo "=== Enrichment complete (run_id=$CREXI_RUN_ID) ===" | tee -a "$LOG"

# ─── Quick spot-check ──────────────────────────────────────────────────────────
echo "" | tee -a "$LOG"
echo "Spot-check: 379 Coronado St, El Granada..." | tee -a "$LOG"
python3 - << 'PYEOF'
import urllib.request, os, json

URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
req = urllib.request.Request(
    f"{URL}/rest/v1/{MAIN_TABLE}?crexi_id=eq.3f61c9e4027ff14493630430d81f03e84e7c0f5b&select=crexi_id,num_units,detail_enriched_at,crexi_api_comp_detail_json(detail_json)",
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"},
)
with urllib.request.urlopen(req) as r:
    rows = json.loads(r.read())
for row in rows:
    emb = row.get("crexi_api_comp_detail_json") or {}
    dj = emb.get("detail_json") or {}
    print(f"  crexi_id:          {row['crexi_id']}")
    print(f"  num_units:         {row['num_units']}")
    print(f"  detail_enriched_at:{row['detail_enriched_at']}")
    print(f"  detail_json.numberOfUnits: {dj.get('numberOfUnits')}")
    print(f"  detail_json.description:   {dj.get('description')}")
PYEOF
