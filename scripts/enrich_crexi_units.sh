#!/bin/bash
# Obsolete browser-driven Crexi detail enrichment entrypoint.
#
# OPE-238 makes crexi_api_comp_detail_json append-only with
# (crexi_id, run_id) identity. Use the maintained Python path, which reads
# bronze through `_latest` views and writes plain detail bronze inserts.

set -euo pipefail

echo "scripts/enrich_crexi_units.sh is obsolete."
echo "Run: python3 scripts/enrich_crexi_units.py"
exit 1
