#!/usr/bin/env bash
#
# Smoke-test PostgREST RPC resolution against a local Supabase instance.
# Catches overload ambiguity (PGRST203) and missing-function errors that
# unit tests with mocked clients cannot detect.
#
# Usage:
#   ./scripts/rpc-smoke-test.sh            # starts/stops Supabase automatically
#   SKIP_SUPABASE_LIFECYCLE=1 ./scripts/rpc-smoke-test.sh  # use already-running instance
#
set -euo pipefail

API_URL="${SUPABASE_API_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SMOKE_RUN_ID="__smoke_test__"
failed=0
total=0

# ── Resolve service role key ────────────────────────────────────────────────

resolve_key() {
    if [ -n "$SERVICE_KEY" ]; then
        return
    fi
    # Try env-style output first (KEY=VALUE), then JSON
    SERVICE_KEY=$(supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | cut -d'=' -f2- | tr -d '"' || true)
    if [ -z "$SERVICE_KEY" ]; then
        SERVICE_KEY=$(supabase status -o env 2>/dev/null | grep '^SUPABASE_SERVICE_ROLE_KEY=' | cut -d'=' -f2- | tr -d '"' || true)
    fi
    if [ -z "$SERVICE_KEY" ]; then
        echo "ERROR: Could not resolve service_role_key from 'supabase status -o env'" >&2
        echo "Output was:" >&2
        supabase status -o env 2>&1 | head -20 >&2
        exit 1
    fi
}

# ── Helpers ─────────────────────────────────────────────────────────────────

call_rpc() {
    local fn_name="$1"
    local payload="$2"
    local desc="$3"
    total=$((total + 1))

    local status body
    body=$(curl -s -w "\n%{http_code}" \
        -X POST "${API_URL}/rest/v1/rpc/${fn_name}" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "$payload")

    status=$(echo "$body" | tail -1)
    body=$(echo "$body" | sed '$d')

    if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
        echo "  PASS  ${desc} (HTTP ${status})"
    elif [ "$status" -eq 409 ]; then
        # 409 = FK/unique constraint violation. PostgREST resolved the function
        # correctly; the error is from execution against an empty local DB.
        echo "  PASS  ${desc} (HTTP ${status} — constraint error, resolution OK)"
    else
        echo "  FAIL  ${desc} (HTTP ${status})"
        echo "        ${body}" | head -3
        failed=$((failed + 1))
    fi
}

# ── Lifecycle ───────────────────────────────────────────────────────────────

if [ "${SKIP_SUPABASE_LIFECYCLE:-}" != "1" ]; then
    echo "Starting local Supabase..."
    supabase start --workdir "$(git rev-parse --show-toplevel)"
fi

resolve_key

echo ""
echo "Running RPC smoke tests against ${API_URL}"
echo "─────────────────────────────────────────────"

# ── insert_cleaned_listing ──────────────────────────────────────────────────

call_rpc "insert_cleaned_listing" '{
    "p_run_id": "'"${SMOKE_RUN_ID}"'",
    "p_scraped_at": "2026-01-01T00:00:00Z",
    "p_zip_code": "00000",
    "p_zpid": "__smoke_1__",
    "p_address_raw": "1 Smoke Test Ln",
    "p_address_street": "1 Smoke Test Ln",
    "p_address_city": "Testville",
    "p_address_state": "CA",
    "p_address_zip": "00000",
    "p_price": 1000,
    "p_beds": 1,
    "p_baths": 1,
    "p_area": 500,
    "p_availability_date": null,
    "p_lat": 37.7749,
    "p_lng": -122.4194,
    "p_home_type": "APARTMENT"
}' "insert_cleaned_listing — single row"

# ── insert_cleaned_listings_bulk ────────────────────────────────────────────

call_rpc "insert_cleaned_listings_bulk" '{
    "rows": [
        {
            "run_id": "'"${SMOKE_RUN_ID}"'",
            "scraped_at": "2026-01-01T00:00:00Z",
            "zip_code": "00000",
            "zpid": "__smoke_bulk_1__",
            "address_raw": "2 Smoke Test Ln",
            "address_street": "2 Smoke Test Ln",
            "address_city": "Testville",
            "address_state": "CA",
            "address_zip": "00000",
            "price": 2000,
            "beds": 2,
            "baths": 1,
            "area": 800,
            "lat": 37.7750,
            "lng": -122.4195,
            "is_building": false,
            "building_zpid": null,
            "home_type": "APARTMENT",
            "laundry": "in_unit"
        }
    ]
}' "insert_cleaned_listings_bulk — single row"

# ── get_zillow_map_listings ─────────────────────────────────────────────────

call_rpc "get_zillow_map_listings" '{
    "p_latest_only": true,
    "p_property_type": "both"
}' "get_zillow_map_listings — minimal params"

# ── refresh_unit_breakdown_views ────────────────────────────────────────────

call_rpc "refresh_unit_breakdown_views" '{}' \
    "refresh_unit_breakdown_views"

# ── Cleanup: delete smoke test rows ─────────────────────────────────────────

echo ""
echo "Cleaning up smoke test data..."
curl -s -o /dev/null \
    -X DELETE "${API_URL}/rest/v1/cleaned_listings?run_id=eq.${SMOKE_RUN_ID}" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}"

if [ "${SKIP_SUPABASE_LIFECYCLE:-}" != "1" ]; then
    echo "Stopping local Supabase..."
    supabase stop --workdir "$(git rev-parse --show-toplevel)"
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────────"
echo "Results: $((total - failed))/${total} passed"

if [ "$failed" -gt 0 ]; then
    echo "FAILED: ${failed} RPC(s) could not be resolved by PostgREST."
    exit 1
fi

echo "All RPCs resolved successfully."
